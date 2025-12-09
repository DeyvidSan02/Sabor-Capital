import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Mic, Sparkles, MapPin, ExternalLink, Plus, Minus, Navigation, Star, Clock, DollarSign, Heart, Eye } from "lucide-react";
import ChatMessage from "@/components/ChatMessage";
import { useToast } from "@/hooks/use-toast";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFavorites } from "@/hooks/useFavorites";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const mapContainerStyle = {
  width: '100%',
  height: '400px'
};

const defaultCenter = {
  lat: 4.6533,
  lng: -74.0836
};

// Íconos SVG codificados
const restaurantIcon = {
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="15" fill="hsl(12, 88%, 58%)" stroke="white" stroke-width="2"/>
      <path fill="white" d="M12 12h2v8h-2zm6 0h2v8h-2zm-3 4v6h-2v-6h-2l3-4 3 4h-2z"/>
    </svg>
  `)}`
};

const userLocationIcon = {
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="hsl(214, 89%, 52%)" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
      <circle cx="16" cy="16" r="3" fill="hsl(214, 89%, 52%)"/>
    </svg>
  `)}`
};

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface Restaurant {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  type?: string;
  price?: string;
  rating?: number;
  description?: string;
  image?: string;
  openingHours?: string | string[];
  phone?: string;
  website?: string;
  openNow?: boolean;
  userRatingsTotal?: number;
  placeId?: string;
}

const ChatIA = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "¡Hola! 👋 Soy Sabor Capital, tu experto en restaurantes de Bogotá 🍽️✨\n\n¿Qué tipo de comida te apetece hoy? Puedo recomendarte lugares increíbles con toda la información que necesitas, incluyendo ubicación exacta 📍",
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasProcessedInitialPrompt, setHasProcessedInitialPrompt] = useState(false);
  const [showResultsPanel, setShowResultsPanel] = useState(true);
  const RESTAURANTS_PER_PAGE = 4;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isFavorite, toggleFavorite } = useFavorites();

  // Cargar conversación desde historial
  useEffect(() => {
    const loadConversation = async () => {
      if (location.state?.loadConversation && location.state?.conversationId) {
        try {
          const { data: conversacion, error: convError } = await supabase
            .from('chat_conversacion')
            .select('*')
            .eq('id_conversacion', location.state.conversationId)
            .maybeSingle();

          if (convError) throw convError;

          if (conversacion) {
            const { data: mensajes, error: msgError } = await supabase
              .from('chat_mensaje')
              .select('*')
              .eq('id_conversacion', conversacion.id_conversacion)
              .order('timestamp', { ascending: true });

            if (msgError) throw msgError;

            if (mensajes && mensajes.length > 0) {
              const loadedMessages: Message[] = mensajes.map(msg => ({
                role: msg.role as "user" | "assistant",
                content: msg.content,
                timestamp: new Date(msg.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
              }));

              setMessages(loadedMessages);
              setCurrentConversationId(conversacion.id_conversacion);

              const allRestaurants: Restaurant[] = [];
              mensajes.forEach(msg => {
                if (msg.role === 'assistant') {
                  const extractedRestaurants = extractRestaurants(msg.content);
                  allRestaurants.push(...extractedRestaurants);
                }
              });

              if (allRestaurants.length > 0) {
                setRestaurants(allRestaurants);
                setShowResultsPanel(true);
              }

              toast({
                title: "Conversación cargada",
                description: `"${conversacion.titulo}" restaurada con ${mensajes.length} mensajes`
              });
            }
          }
        } catch (error) {
          console.error('Error cargando conversación:', error);
          toast({
            title: "Error",
            description: "No se pudo cargar la conversación",
            variant: "destructive"
          });
        }
      }
    };

    loadConversation();
  }, [location.state]);

  const saveConversation = async (userMsg: Message, assistantMsg: Message) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let conversationId = currentConversationId;

      if (!conversationId) {
        const titulo = userMsg.content.substring(0, 100) + (userMsg.content.length > 100 ? '...' : '');

        const { data: newConv, error: convError } = await supabase
          .from('chat_conversacion')
          .insert({
            id_usuario: user.id,
            titulo: titulo
          })
          .select()
          .single();

        if (convError) throw convError;
        conversationId = newConv.id_conversacion;
        setCurrentConversationId(conversationId);

        const { error: histError } = await supabase
          .from('historial_busqueda')
          .insert({
            id_usuario: user.id,
            query: userMsg.content,
            id_conversacion: conversationId
          });

        if (histError) console.error('Error creando historial de busqueda:', histError);
      }

      const { error: msgError } = await supabase
        .from('chat_mensaje')
        .insert([
          {
            id_conversacion: conversationId,
            role: userMsg.role,
            content: userMsg.content
          },
          {
            id_conversacion: conversationId,
            role: assistantMsg.role,
            content: assistantMsg.content
          }
        ]);

      if (msgError) throw msgError;

    } catch (error) {
      console.error('Error guardando conversación:', error);
    }
  };

  const quickSuggestions = [
    "🍴 Restaurantes románticos",
    "💰 Comida económica",
    "🥗 Opciones vegetarianas",
    "🇨🇴 Comida colombiana",
    "🌮 Lugares para desayuno",
    "🏙️ Rooftops con vista",
    "👨‍👩‍👧‍👦 Restaurantes familiares",
    "💼 Reuniones de negocio",
  ];

  const restaurantImages = [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1579027989536-b7b1f875659b?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Guardar estado
  useEffect(() => {
    sessionStorage.setItem('chatIA_state', JSON.stringify({
      messages,
      restaurants,
      currentConversationId
    }));
  }, [messages, restaurants, currentConversationId]);

  const extractRestaurants = (content: string): Restaurant[] => {
    const restaurants: Restaurant[] = [];

    const placesDataMatch = content.match(/<!--PLACES_DATA:(.*?)-->/s);
    if (placesDataMatch) {
      try {
        const placesData = JSON.parse(placesDataMatch[1]);

        return placesData.map((place: any) => {
          const convertPriceLevel = (priceLevel: string): string => {
            const priceLevelMap: { [key: string]: string } = {
              'PRICE_LEVEL_FREE': '$',
              'PRICE_LEVEL_INEXPENSIVE': '$',
              'PRICE_LEVEL_MODERATE': '$$',
              'PRICE_LEVEL_EXPENSIVE': '$$$',
              'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
              'PRICE_LEVEL_UNSPECIFIED': '$$'
            };
            return priceLevelMap[priceLevel] || '$$';
          };

          return {
            placeId: place.place_id,
            name: place.name,
            lat: place.location.lat,
            lng: place.location.lng,
            rating: place.rating || 0,
            price: convertPriceLevel(place.price_level),
            type: place.types?.[0]?.replace(/_/g, ' ') || 'restaurant',
            address: place.formatted_address,
            phone: place.phone_number,
            website: place.website,
            openNow: place.open_now,
            openingHours: place.opening_hours,
            image: place.photos?.[0] || restaurantImages[Math.floor(Math.random() * restaurantImages.length)],
            userRatingsTotal: place.user_ratings_total || 0,
            description: `Restaurante con ${place.rating || 0} estrellas y ${place.user_ratings_total || 0} reseñas`
          };
        });
      } catch (error) {
        console.error('Error parseando Places API data:', error);
      }
    }

    const cleanContent = content
      .replace(/\*\*\*/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '');

    const restaurantSections = cleanContent.split(/(?=🍽️\s*\*)/);

    for (const section of restaurantSections) {
      try {
        const nameMatch = section.match(/🍽️\s*\*{0,2}([^\n*-]+)/i);
        const coordMatch = section.match(/Coordenadas:\s*([-\d.]+),\s*([-\d.]+)/i);

        if (coordMatch) {
          const name = nameMatch ? nameMatch[1].trim() : "Restaurante Recomendado";
          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);

          if (lat >= 4.5 && lat <= 4.8 && lng >= -74.2 && lng <= -74.0) {
            const typeMatch = section.match(/Tipo:\s*([^\n]+)/i);
            const priceMatch = section.match(/Precio:\s*([^\n]+)/i);
            const addressMatch = section.match(/Dirección:\s*([^\n]+)/i);
            const descriptionMatch = section.match(/Especialidad:\s*([^\n]+)/i);
            const ratingMatch = section.match(/Valoración:\s*⭐\s*([\d.]+)/i);

            const randomImage = restaurantImages[Math.floor(Math.random() * restaurantImages.length)];
            const randomRating = ratingMatch ? parseFloat(ratingMatch[1]) : parseFloat((3.5 + Math.random() * 1.5).toFixed(1));

            const restaurant: Restaurant = {
              name: name,
              lat: lat,
              lng: lng,
              address: addressMatch ? addressMatch[1].trim() : "Bogotá, Colombia",
              type: typeMatch ? typeMatch[1].trim() : "Comida variada",
              price: priceMatch ? priceMatch[1].trim() : "$$",
              rating: randomRating,
              description: descriptionMatch ? descriptionMatch[1].trim() : `Excelente restaurante ${name} recomendado por Sabor Capital`,
              image: randomImage,
              openingHours: "11:00 AM - 10:00 PM",
              userRatingsTotal: Math.floor(Math.random() * 100) + 10
            };

            restaurants.push(restaurant);
          }
        }
      } catch (error) {
        console.error('Error procesando sección de restaurante:', error);
      }
    }

    return restaurants;
  };

  const handleSend = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: inputMessage.trim(),
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      let preferencesContext = '';
      if (userProfile?.tipo_comida?.length > 0 || userProfile?.presupuesto || userProfile?.ubicacion) {
        preferencesContext = `\n\n**PREFERENCIAS DEL USUARIO:**
${userProfile.tipo_comida?.length > 0 ? `- Tipos de comida favoritos: ${userProfile.tipo_comida.join(', ')}` : ''}
${userProfile.presupuesto ? `- Presupuesto preferido: ${userProfile.presupuesto}` : ''}
${userProfile.ubicacion ? `- Ubicación preferida: ${userProfile.ubicacion}` : ''}`;
      }

      const systemPrompt = `Eres Sabor Capital, un asistente experto en restaurantes de Bogotá, Colombia. 

Tu misión es ayudar a los usuarios a encontrar el lugar perfecto para comer en Bogotá.

**INSTRUCCIONES IMPORTANTES:**
- SIEMPRE menciona las **coordenadas exactas** de cada restaurante
- Habla de forma amigable y entusiasta
- Da recomendaciones específicas
- Si te preguntan por un tipo de comida o zona, busca restaurantes relevantes
- Menciona detalles como calificación, precio, dirección y tipo de cocina
${preferencesContext}

**DETECCIÓN DE CONSULTAS GENERALES:**
Si el usuario te saluda o pregunta algo general como "hola", "qué recomiendas", "ayúdame a buscar" o no especifica qué tipo de comida quiere:
1. Responde el saludo de forma amigable
2. Pregúntale si quiere ver recomendaciones basadas en sus preferencias guardadas o si prefiere que le recomiendes algo general
3. Ejemplo: "¡Hola! 👋 Veo que tienes preferencias guardadas. ¿Quieres que busque restaurantes basándome en tus gustos (${userProfile?.tipo_comida?.join(', ') || 'tus preferencias'}) o prefieres que te recomiende algo diferente?"
`;

      const response = await fetch(
        `https://ozladdazcubyvmgdpyop.supabase.co/functions/v1/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemPrompt: systemPrompt,
            userPreferences: userProfile ? {
              tipo_comida: userProfile.tipo_comida,
              presupuesto: userProfile.presupuesto,
              ubicacion: userProfile.ubicacion
            } : undefined,
            messages: [...messages, userMessage].map(m => ({
              role: m.role,
              content: m.content
            }))
          })
        }
      );

      if (!response.ok || !response.body) {
        throw new Error('Error al conectar con el asistente');
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: "",
        timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMessage]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedRestaurants: Restaurant[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'metadata' && parsed.restaurants) {
                receivedRestaurants = parsed.restaurants.map((place: any) => {
                  const convertPriceLevel = (priceLevel: string): string => {
                    const priceLevelMap: { [key: string]: string } = {
                      'PRICE_LEVEL_FREE': '$',
                      'PRICE_LEVEL_INEXPENSIVE': '$',
                      'PRICE_LEVEL_MODERATE': '$$',
                      'PRICE_LEVEL_EXPENSIVE': '$$$',
                      'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
                      'PRICE_LEVEL_UNSPECIFIED': '$$'
                    };
                    return priceLevelMap[priceLevel] || '$$';
                  };

                  return {
                    placeId: place.place_id,
                    name: place.name,
                    lat: place.location.lat,
                    lng: place.location.lng,
                    rating: place.rating || 0,
                    price: convertPriceLevel(place.price_level),
                    type: place.types?.[0]?.replace(/_/g, ' ') || 'restaurant',
                    address: place.formatted_address,
                    phone: place.phone_number,
                    website: place.website,
                    openNow: place.open_now,
                    openingHours: place.opening_hours,
                    image: place.photos?.[0] ? getPhotoUrl(place.photos[0], 800) : restaurantImages[Math.floor(Math.random() * restaurantImages.length)],
                    userRatingsTotal: place.user_ratings_total || 0,
                    description: `${place.name} - ${place.rating || 0} ⭐ (${place.user_ratings_total || 0} reseñas)`
                  };
                });

                setRestaurants(receivedRestaurants);
                setShowResultsPanel(true);
                setCurrentPage(1);
                continue;
              }

              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;

              if (text) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === "assistant") {
                    lastMessage.content += text;
                  }
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('Error parseando el SSE:', e);
            }
          }
        }
      }

      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        const firstUserMessage = newMessages[newMessages.length - 2];

        if (lastMessage.role === "assistant") {
          saveConversation(firstUserMessage, lastMessage);

          if (receivedRestaurants.length > 0 && map) {
            map.panTo({ lat: receivedRestaurants[0].lat, lng: receivedRestaurants[0].lng });
            map.setZoom(14);
          }
        }
        return newMessages;
      });

    } catch (error) {
      console.error('Error enviando el mensaje:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje. Por favor intenta de nuevo.",
        variant: "destructive"
      });

      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.role === "assistant" && !lastMessage.content) {
          newMessages.pop();
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSuggestion = (suggestion: string) => {
    setInputMessage(suggestion);
  };

  const handleZoomIn = () => {
    if (map) map.setZoom((map.getZoom() || 13) + 1);
  };

  const handleZoomOut = () => {
    if (map) map.setZoom((map.getZoom() || 13) - 1);
  };

  const handleLocate = () => {
    if (navigator.geolocation && map) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          map.panTo({ lat: latitude, lng: longitude });
          map.setZoom(16);
        },
        (error) => {
          toast({
            title: "Error",
            description: "No se pudo obtener tu ubicación",
            variant: "destructive"
          });
        }
      );
    }
  };

  const onMapLoad = (mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    setIsMapLoaded(true);
  };

  const getPriceLevel = (price: string) => {
    const priceCount = (price.match(/\$/g) || []).length;
    return Array.from({ length: 4 }, (_, i) => (
      <DollarSign
        key={i}
        className={`h-3 w-3 ${i < priceCount ? 'text-green-600 fill-green-600' : 'text-gray-300'}`}
      />
    ));
  };

  const handleRestaurantClick = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);

    if (map && restaurant.lat && restaurant.lng && !isNaN(restaurant.lat) && !isNaN(restaurant.lng)) {
      map.panTo({ lat: restaurant.lat, lng: restaurant.lng });
      map.setZoom(16);

      setTimeout(() => {
        setSelectedRestaurant(null);
        setTimeout(() => setSelectedRestaurant(restaurant), 50);
      }, 100);
    }
  };

  return (
    <div className="flex h-full bg-background">
      {/* Panel izquierdo - Chat */}
      <div className={`flex flex-col transition-all duration-300 ${showResultsPanel ? 'w-1/2' : 'w-full'} border-r border-border`}>
        <div className="flex-1 overflow-hidden">
          <div className="p-6 h-full flex flex-col">
            {/* Encabezado del chat */}
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
                ¡Hola! Soy Sabor Capital 🍽️
              </h1>
              <p className="text-sm text-muted-foreground">
                Tu asistente experto para encontrar los mejores restaurantes de Bogotá
              </p>
            </div>

            {/* Sugerencias rápidas */}
            <div className="flex flex-wrap gap-2 mb-6">
              {quickSuggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSuggestion(suggestion)}
                  className="rounded-full text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {suggestion}
                </Button>
              ))}
            </div>

            {/* Historial del chat */}
            <div className="flex-1 overflow-y-auto pr-4 space-y-4">
              {messages.map((message, index) => (
                <ChatMessage
                  key={index}
                  role={message.role}
                  content={message.content}
                  timestamp={message.timestamp}
                />
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <ChatMessage
                  role="assistant"
                  content="Buscando las mejores opciones para ti..."
                  timestamp={new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                />
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input para enviar mensajes */}
            <div className="pt-4 mt-4 border-t border-border">
              <div className="flex gap-2">
                <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-foreground">
                  <Mic className="h-5 w-5" />
                </Button>
                <Input
                  placeholder="Escribe tu mensaje..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={isLoading || !inputMessage.trim()}
                  size="icon"
                  className="bg-primary hover:bg-primary/90"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel derecho - Resultados (solo visible cuando hay restaurantes) */}
      {showResultsPanel && restaurants.length > 0 && (
        <div className="w-1/2 flex flex-col h-full">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Resultados de búsqueda</h2>
              <Badge variant="secondary" className="ml-2">
                {restaurants.length} restaurantes
              </Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowResultsPanel(false)}
              className="md:hidden"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Mapa */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">🗺️ Ubicación de restaurantes</h3>
                </div>
              </div>

              <div className="relative h-[400px]">
                <LoadScript
                  googleMapsApiKey={GOOGLE_MAPS_API_KEY}
                  onLoad={() => setIsMapLoaded(true)}
                >
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={restaurants.length > 0 ? { lat: restaurants[0].lat, lng: restaurants[0].lng } : defaultCenter}
                    zoom={13}
                    onLoad={onMapLoad}
                    options={{
                      disableDefaultUI: true,
                      zoomControl: false,
                    }}
                  >
                    {isMapLoaded && restaurants.map((restaurant, index) => (
                      <Marker
                        key={`${restaurant.name}-${index}`}
                        position={{ lat: restaurant.lat, lng: restaurant.lng }}
                        onClick={() => handleRestaurantClick(restaurant)}
                        icon={restaurantIcon}
                      />
                    ))}

                    {isMapLoaded && selectedRestaurant && (
                      <InfoWindow
                        position={{ lat: selectedRestaurant.lat, lng: selectedRestaurant.lng }}
                        onCloseClick={() => setSelectedRestaurant(null)}
                      >
                        <div className="p-2 max-w-xs">
                          <h4 className="font-semibold text-sm mb-1">{selectedRestaurant.name}</h4>
                          {selectedRestaurant.type && (
                            <Badge variant="secondary" className="text-xs mb-2">
                              {selectedRestaurant.type}
                            </Badge>
                          )}
                          {selectedRestaurant.address && (
                            <p className="text-xs text-gray-600 mb-2">{selectedRestaurant.address}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {selectedRestaurant.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                <span>{selectedRestaurant.rating}</span>
                              </div>
                            )}
                            {selectedRestaurant.price && (
                              <div className="flex items-center gap-1">
                                {getPriceLevel(selectedRestaurant.price)}
                              </div>
                            )}
                          </div>
                        </div>
                      </InfoWindow>
                    )}
                  </GoogleMap>
                </LoadScript>

                <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
                  <Button
                    size="icon"
                    onClick={handleZoomIn}
                    className="bg-primary hover:bg-primary-hover text-primary-foreground rounded-full h-10 w-10"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={handleZoomOut}
                    className="bg-primary hover:bg-primary-hover text-primary-foreground rounded-full h-10 w-10"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={handleLocate}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full h-10 w-10"
                  >
                    <Navigation className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista de restaurantes */}
            <div className="bg-card rounded-lg border border-border">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">🌟 Restaurantes recomendados</h3>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    ⭐ 2.0+ • ✅ Vigentes
                  </Badge>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {restaurants
                  .slice((currentPage - 1) * RESTAURANTS_PER_PAGE, currentPage * RESTAURANTS_PER_PAGE)
                  .map((restaurant, index) => (
                    <Card
                      key={index}
                      className={`cursor-pointer transition-all hover:shadow-lg border ${selectedRestaurant?.name === restaurant.name
                        ? 'border-primary shadow-lg'
                        : 'border-border'
                        }`}
                      onClick={() => handleRestaurantClick(restaurant)}
                    >
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <div className="relative h-24 w-24 flex-shrink-0 rounded-lg overflow-hidden">
                            <img
                              src={restaurant.image}
                              alt={restaurant.name}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-foreground line-clamp-1">{restaurant.name}</h4>
                              {restaurant.rating && (
                                <Badge variant="default" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 text-xs">
                                  ⭐ {restaurant.rating.toFixed(1)}
                                </Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {restaurants.map((restaurant, index) => (
                                <Card
                                  key={index}
                                  className={`restaurant-card cursor-pointer transition-all hover:shadow-lg border-2 ${selectedRestaurant?.name === restaurant.name
                                    ? 'border-primary shadow-xl'
                                    : 'border-border hover:border-primary/50'
                                    }`}
                                  onClick={() => handleRestaurantClick(restaurant)}
                                >
                                  <div className="relative h-48 overflow-hidden rounded-t-lg">
                                    <img
                                      src={restaurant.image}
                                      alt={restaurant.name}
                                      className="w-full h-full object-cover"
                                    />
                                    {restaurant.openNow !== undefined && (
                                      <Badge
                                        variant={restaurant.openNow ? "default" : "destructive"}
                                        className="absolute top-2 right-2 text-xs"
                                      >
                                        {restaurant.openNow ? '🟢 Abierto' : '🔴 Cerrado'}
                                      </Badge>
                                    )}
                                  </div>

                                  <CardContent className="p-5">
                                    {/* NOMBRE DEL RESTAURANTE DESTACADO */}
                                    <div className="flex items-start justify-between mb-3">
                                      <h4 className="font-bold text-lg text-foreground line-clamp-1">{restaurant.name}</h4>
                                      {restaurant.rating && (
                                        <Badge variant="default" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 text-sm ml-2 flex-shrink-0">
                                          ⭐ {restaurant.rating.toFixed(1)}
                                        </Badge>
                                      )}

                                      {restaurant.type && (
                                        <Badge variant="secondary" className="mb-3 text-sm">
                                          {restaurant.type}
                                        </Badge>
                                      )}

                                      <div className="space-y-2 text-sm">
                                        {restaurant.address && (
                                          <div className="flex items-start gap-2 text-muted-foreground">
                                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                            <span className="line-clamp-2 text-sm">{restaurant.address}</span>
                                          </div>
                                        )}

                                        <div className="flex items-center justify-between mt-3">
                                          <div className="flex gap-3">
                                            <Button
                                              size="sm"
                                              variant={isFavorite(restaurant.placeId || '') ? "default" : "outline"}
                                              className="h-8 text-xs gap-1.5"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFavorite(restaurant.placeId || '');
                                              }}
                                            >
                                              <Heart className={`h-3 w-3 ${isFavorite(restaurant.placeId || '') ? 'fill-current' : ''}`} />
                                              Guardar
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="default"
                                              className="h-8 text-xs gap-1.5"
                                              asChild
                                            >
                                              <a
                                                href={`/restaurantes/${restaurant.placeId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <Eye className="h-3 w-3" />
                                                Detalle
                                              </a>
                                            </Button>
                                          </div>

                                          {restaurant.price && (
                                            <div className="flex items-center gap-1">
                                              {getPriceLevel(restaurant.price)}
                                            </div>
                                          )}

                                          {restaurant.userRatingsTotal && (
                                            <span className="text-muted-foreground text-sm">
                                              ({restaurant.userRatingsTotal} reseñas)
                                            </span>
                                          )}
                                        </div>

                                        {restaurant.description && (
                                          <p className="text-muted-foreground text-sm line-clamp-2">
                                            {restaurant.description}
                                          </p>
                                        )}

                                        {/* Botones de acción */}
                                        <div className="flex gap-3 mt-4 pt-3 border-t border-border">
                                          <Button
                                            size="default"
                                            variant={isFavorite(restaurant.placeId || '') ? "default" : "outline"}
                                            className="flex-1 h-10 text-sm gap-2"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleFavorite(restaurant.placeId || '');
                                            }}
                                          >
                                            <Heart className={`h-4 w-4 ${isFavorite(restaurant.placeId || '') ? 'fill-current' : ''}`} />
                                            {isFavorite(restaurant.placeId || '') ? 'Guardado' : 'Guardar'}
                                          </Button>
                                          <Button
                                            size="default"
                                            variant="default"
                                            className="flex-1 h-10 text-sm gap-2"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigate(`/restaurantes/${restaurant.placeId}`);
                                            }}
                                          >
                                            <Eye className="h-4 w-4" />
                                            Ver detalle
                                          </Button>
                                        </div>

                                        {(restaurant.website || restaurant.phone) && (
                                          <div className="flex gap-2 mt-2">
                                            {restaurant.website && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="flex-1 h-9 text-sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  window.open(restaurant.website, '_blank');
                                                }}
                                              >
                                                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                                Web
                                              </Button>
                                            )}
                                            {restaurant.phone && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="flex-1 h-9 text-sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  window.open(`tel:${restaurant.phone}`, '_blank');
                                                }}
                                              >
                                                📞 Llamar
                                              </Button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}

                              {/* Paginación */}
                              {restaurants.length > RESTAURANTS_PER_PAGE && (
                                <div className="flex justify-center items-center gap-4 mt-4 pt-4 border-t border-border">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="gap-2 text-xs"
                                  >
                                    <ChevronLeft className="h-3 w-3" />
                                    Anterior
                                  </Button>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      Página {currentPage} de {Math.ceil(restaurants.length / RESTAURANTS_PER_PAGE)}
                                    </span>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(restaurants.length / RESTAURANTS_PER_PAGE), prev + 1))}
                                    disabled={currentPage === Math.ceil(restaurants.length / RESTAURANTS_PER_PAGE)}
                                    className="gap-2 text-xs"
                                  >
                                    Siguiente
                                    <ChevronRight className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
      )}

                      {/* Botón para mostrar resultados en móvil */}
                      {!showResultsPanel && restaurants.length > 0 && (
                        <Button
                          className="fixed bottom-4 right-4 z-50 md:hidden"
                          size="icon"
                          onClick={() => setShowResultsPanel(true)}
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  );
};

                export default ChatIA;