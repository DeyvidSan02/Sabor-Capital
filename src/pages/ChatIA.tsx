import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Send, Mic, Sparkles, MapPin, ExternalLink, 
  Plus, Minus, Navigation, Star, DollarSign, 
  Heart, Eye, ChevronLeft, ChevronRight,
  ArrowLeft
} from "lucide-react";
import ChatMessage from "@/components/ChatMessage";
import { useToast } from "@/hooks/use-toast";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFavorites } from "@/hooks/useFavorites";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getPhotoUrl } from "@/hooks/useRestaurants";

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
  const [inputMessage, setInputMessage] = useState(location.state?.initialPrompt || "");
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
  const [showResultsPanel, setShowResultsPanel] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const RESTAURANTS_PER_PAGE = 4;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { data: userProfile } = useUserProfile();

  // Limpiar estado al salir del componente
  useEffect(() => {
    return () => {
      sessionStorage.removeItem('chatIA_state');
    };
  }, []);

  // Efecto principal para manejar la carga inicial
  useEffect(() => {
    console.log('🔍 Estado de location:', {
      loadConversation: location.state?.loadConversation,
      conversationId: location.state?.conversationId,
      fromDashboard: location.state?.fromDashboard,
      initialPrompt: location.state?.initialPrompt
    });

    const initializeChat = async () => {
      const fromHistory = location.state?.loadConversation;
      const fromDashboard = location.state?.fromDashboard;
      
      if (fromHistory && location.state?.conversationId) {
        console.log('📥 Cargando desde historial:', location.state.conversationId);
        setIsLoadingHistory(true);
        try {
          await loadConversation(location.state.conversationId);
        } catch (error) {
          console.error('Error cargando conversación:', error);
          toast({
            title: "Error",
            description: "No se pudo cargar la conversación",
            variant: "destructive"
          });
        } finally {
          setIsLoadingHistory(false);
        }
        // Limpiar el estado para que no se vuelva a cargar
        window.history.replaceState({}, document.title);
      } else if (fromDashboard && location.state?.initialPrompt) {
        console.log('🚀 Viene del dashboard con prompt:', location.state.initialPrompt);
        setInputMessage(location.state.initialPrompt);
        // No procesamos automáticamente aquí, esperamos al useEffect siguiente
      } else {
        // Cargar estado guardado si existe
        const savedState = sessionStorage.getItem('chatIA_state');
        if (savedState) {
          console.log('💾 Restaurando estado guardado');
          try {
            const state = JSON.parse(savedState);
            if (state.messages && state.messages.length > 0) {
              setMessages(state.messages);
              setRestaurants(state.restaurants || []);
              setCurrentConversationId(state.currentConversationId);
              setShowResultsPanel((state.restaurants?.length || 0) > 0);
            }
          } catch (error) {
            console.error('Error restaurando estado:', error);
          }
        }
      }
    };

    initializeChat();
  }, [location.state]);

  // Enviar prompt inicial si viene del dashboard
  useEffect(() => {
    if (location.state?.initialPrompt && inputMessage && !hasProcessedInitialPrompt && location.state?.fromDashboard) {
      console.log('⚡ Procesando prompt del dashboard:', inputMessage);
      setTimeout(() => {
        handleSend();
        setHasProcessedInitialPrompt(true);
        
        toast({
          title: "Búsqueda iniciada",
          description: `Buscando restaurantes para: "${inputMessage}"`,
          duration: 3000
        });
      }, 800);
    }
  }, [location.state, inputMessage, hasProcessedInitialPrompt]);

  // Cargar conversación completa desde la base de datos
  const loadConversation = async (conversationId: string) => {
    try {
      console.log('🔍 Cargando conversación:', conversationId);
      
      // 1. Cargar conversación
      const { data: conversacion, error: convError } = await supabase
        .from('chat_conversacion')
        .select('*')
        .eq('id_conversacion', conversationId)
        .maybeSingle();

      if (convError) throw convError;

      if (!conversacion) {
        throw new Error('Conversación no encontrada');
      }

      // 2. Cargar mensajes
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

        let loadedRestaurants: Restaurant[] = [];

        // 3. Intentar cargar restaurantes desde resultado_busqueda
        try {
          console.log('🔍 Buscando historial para conversación:', conversationId);
          const { data: historial, error: histError } = await supabase
            .from('historial_busqueda')
            .select('id_busqueda')
            .eq('id_conversacion', conversationId)
            .maybeSingle();

          if (!histError && historial) {
            console.log('🔍 Buscando resultados para búsqueda:', historial.id_busqueda);
            const { data: resultados, error: resError } = await supabase
              .from('resultado_busqueda')
              .select('metadata')
              .eq('id_busqueda', historial.id_busqueda);

            if (!resError && resultados && resultados.length > 0) {
              console.log('📦 Encontrados resultados:', resultados.length);
              // Tomar el primer resultado que tenga metadata
              const resultadoConMetadata = resultados.find(r => r.metadata);
              if (resultadoConMetadata?.metadata) {
                try {
                  const restaurantData = JSON.parse(resultadoConMetadata.metadata);
                  console.log('📊 Metadata parseada:', typeof restaurantData);
                  
                  if (Array.isArray(restaurantData) && restaurantData.length > 0) {
                    loadedRestaurants = restaurantData.map((place: any) => ({
                      placeId: place.place_id || place.id || `rest-${Math.random()}`,
                      name: place.name || 'Restaurante',
                      lat: place.location?.lat || place.lat || defaultCenter.lat,
                      lng: place.location?.lng || place.lng || defaultCenter.lng,
                      rating: place.rating || 3.5,
                      price: place.price || '$$',
                      type: place.types?.[0]?.replace(/_/g, ' ') || place.type || 'restaurant',
                      address: place.formatted_address || place.address || 'Bogotá, Colombia',
                      phone: place.phone_number || '',
                      website: place.website || '',
                      openNow: place.open_now || false,
                      image: place.photos?.[0] ? getPhotoUrl(place.photos[0], 800) : 
                             `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop`,
                      userRatingsTotal: place.user_ratings_total || Math.floor(Math.random() * 100) + 10,
                      description: `${place.name || 'Restaurante'} - ${place.rating || 3.5} ⭐`
                    }));
                    
                    console.log('✅ Restaurantes cargados desde metadata:', loadedRestaurants.length);
                  } else if (typeof restaurantData === 'object' && restaurantData.name) {
                    // Si es un solo objeto, convertirlo a array
                    loadedRestaurants = [{
                      placeId: restaurantData.place_id || restaurantData.id || `rest-${Math.random()}`,
                      name: restaurantData.name || 'Restaurante',
                      lat: restaurantData.location?.lat || restaurantData.lat || defaultCenter.lat,
                      lng: restaurantData.location?.lng || restaurantData.lng || defaultCenter.lng,
                      rating: restaurantData.rating || 3.5,
                      price: restaurantData.price || '$$',
                      type: restaurantData.types?.[0]?.replace(/_/g, ' ') || restaurantData.type || 'restaurant',
                      address: restaurantData.formatted_address || restaurantData.address || 'Bogotá, Colombia',
                      phone: restaurantData.phone_number || '',
                      website: restaurantData.website || '',
                      openNow: restaurantData.open_now || false,
                      image: restaurantData.photos?.[0] ? getPhotoUrl(restaurantData.photos[0], 800) : 
                             `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop`,
                      userRatingsTotal: restaurantData.user_ratings_total || Math.floor(Math.random() * 100) + 10,
                      description: `${restaurantData.name || 'Restaurante'} - ${restaurantData.rating || 3.5} ⭐`
                    }];
                    console.log('✅ Restaurante cargado desde metadata (objeto único)');
                  }
                } catch (parseError) {
                  console.error('❌ Error parseando metadata:', parseError);
                }
              }
            }
          }
        } catch (error) {
          console.error('❌ Error cargando de resultado_busqueda:', error);
        }

        // 4. Si no hay metadata o hay pocos restaurantes, extraer de los mensajes
        if (loadedRestaurants.length === 0) {
          console.log('🔍 Extrayendo restaurantes de mensajes...');
          const extractedRestaurants: Restaurant[] = [];
          
          mensajes.forEach(msg => {
            if (msg.role === 'assistant') {
              const restaurantsFromMsg = extractRestaurants(msg.content);
              extractedRestaurants.push(...restaurantsFromMsg);
            }
          });

          // Filtrar duplicados por nombre y coordenadas
          const uniqueRestaurants = extractedRestaurants.filter((restaurant, index, self) => {
            const firstIndex = self.findIndex(r => 
              r.name === restaurant.name && 
              r.lat === restaurant.lat && 
              r.lng === restaurant.lng
            );
            return index === firstIndex;
          });

          loadedRestaurants = uniqueRestaurants;
          console.log('✅ Restaurantes extraídos de mensajes:', loadedRestaurants.length);
        }

        // 5. Si aún no hay restaurantes, crear algunos de ejemplo basados en la conversación
        if (loadedRestaurants.length === 0) {
          console.log('⚠️ No se encontraron restaurantes, creando ejemplos');
          const query = mensajes.find(m => m.role === 'user')?.content || 'restaurantes';
          loadedRestaurants = generateSampleRestaurants(query);
        }

        if (loadedRestaurants.length > 0) {
          setRestaurants(loadedRestaurants);
          setShowResultsPanel(true);
          console.log('✅ Panel de resultados activado con', loadedRestaurants.length, 'restaurantes');
        } else {
          console.log('⚠️ No se pudieron cargar restaurantes');
        }

        toast({
          title: "Conversación cargada",
          description: `"${conversacion.titulo}" restaurada con ${mensajes.length} mensajes${loadedRestaurants.length > 0 ? ` y ${loadedRestaurants.length} restaurantes` : ''}`
        });
      }
    } catch (error) {
      console.error('❌ Error cargando conversación:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la conversación completa",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Función para generar restaurantes de ejemplo
  const generateSampleRestaurants = (query: string): Restaurant[] => {
    const restaurantImages = [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1579027989536-b7b1f875659b?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop"
    ];

    const sampleRestaurants = [
      {
        name: "Restaurante Andrés Carne de Res",
        lat: 4.6932,
        lng: -74.0337,
        address: "Cra. 11a #93-52, Bogotá",
        type: "Comida Colombiana",
        price: "$$$",
        rating: 4.3,
        image: restaurantImages[0]
      },
      {
        name: "Harry Sasson",
        lat: 4.6482,
        lng: -74.0632,
        address: "Cra. 5 #69a-44, Bogotá",
        type: "Gourmet Internacional",
        price: "$$$$",
        rating: 4.7,
        image: restaurantImages[1]
      },
      {
        name: "El Cielo",
        lat: 4.6568,
        lng: -74.0594,
        address: "Cl. 70 #4-62, Bogotá",
        type: "Gastronomía Molecular",
        price: "$$$$",
        rating: 4.5,
        image: restaurantImages[2]
      },
      {
        name: "Mesa Franca",
        lat: 4.6750,
        lng: -74.0520,
        address: "Cl. 69a #6-46, Bogotá",
        type: "Fusión Latinoamericana",
        price: "$$$",
        rating: 4.4,
        image: restaurantImages[3]
      }
    ];

    return sampleRestaurants.map((rest, index) => ({
      ...rest,
      placeId: `sample-${index}-${Date.now()}`,
      description: `${rest.name} - ${rest.rating} ⭐ recomendado para "${query}"`,
      openingHours: "11:00 AM - 10:00 PM",
      phone: "+57 1 1234567",
      website: "https://ejemplo.com",
      openNow: true,
      userRatingsTotal: Math.floor(Math.random() * 500) + 100
    }));
  };

  const saveConversation = async (userMsg: Message, assistantMsg: Message) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let conversationId = currentConversationId;

      // Si no existe conversación, crear una nueva
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

        // Crear entrada en historial_busqueda vinculada a esta conversación
        const { error: histError } = await supabase
          .from('historial_busqueda')
          .insert({
            id_usuario: user.id,
            query: userMsg.content,
            id_conversacion: conversationId
          });

        if (histError) console.error('Error creando historial de busqueda:', histError);
      }

      // Guardar ambos mensajes
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

      console.log('✅ Conversación guardada:', conversationId);
    } catch (error) {
      console.error('Error guardando conversación:', error);
    }
  };

  // Guardar estado del chat en sessionStorage cuando hay cambios
  useEffect(() => {
    if (messages.length > 1 || restaurants.length > 0) {
      const stateToSave = {
        messages,
        restaurants,
        currentConversationId,
        showResultsPanel: showResultsPanel && restaurants.length > 0
      };
      sessionStorage.setItem('chatIA_state', JSON.stringify(stateToSave));
    }
  }, [messages, restaurants, currentConversationId, showResultsPanel]);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const extractRestaurants = (content: string): Restaurant[] => {
    const restaurants: Restaurant[] = [];

    // Try to extract Places API metadata first (hidden in HTML comments)
    const placesDataMatch = content.match(/<!--PLACES_DATA:(.*?)-->/s);
    if (placesDataMatch) {
      try {
        const placesData = JSON.parse(placesDataMatch[1]);
        console.log('📍 Extraídos restaurantes de metadata:', placesData.length);

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
            placeId: place.place_id || place.id,
            name: place.name,
            lat: place.location?.lat || place.lat || defaultCenter.lat,
            lng: place.location?.lng || place.lng || defaultCenter.lng,
            rating: place.rating || 0,
            price: convertPriceLevel(place.price_level),
            type: place.types?.[0]?.replace(/_/g, ' ') || 'restaurant',
            address: place.formatted_address || place.address || 'Bogotá, Colombia',
            phone: place.phone_number || '',
            website: place.website || '',
            openNow: place.open_now || false,
            openingHours: place.opening_hours || "11:00 AM - 10:00 PM",
            image: place.photos?.[0] ? getPhotoUrl(place.photos[0], 800) : 
                   `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop`,
            userRatingsTotal: place.user_ratings_total || 0,
            description: `Restaurante con ${place.rating || 0} estrellas y ${place.user_ratings_total || 0} reseñas`
          };
        });
      } catch (error) {
        console.error('Error parseando Places API data:', error);
      }
    }

    // Extraer restaurantes del texto del asistente
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

            const randomImage = `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop`;
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

    console.log('🔍 Restaurantes extraídos del texto:', restaurants.length);
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
                console.log('📦 Recibidos restaurantes de metadata:', parsed.restaurants.length);
                
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
                    lat: place.location?.lat || place.lat || defaultCenter.lat,
                    lng: place.location?.lng || place.lng || defaultCenter.lng,
                    rating: place.rating || 0,
                    price: convertPriceLevel(place.price_level),
                    type: place.types?.[0]?.replace(/_/g, ' ') || 'restaurant',
                    address: place.formatted_address || place.address || 'Bogotá, Colombia',
                    phone: place.phone_number || '',
                    website: place.website || '',
                    openNow: place.open_now || false,
                    openingHours: place.opening_hours || "11:00 AM - 10:00 PM",
                    image: place.photos?.[0] ? getPhotoUrl(place.photos[0], 800) : 
                           `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop`,
                    userRatingsTotal: place.user_ratings_total || 0,
                    description: `${place.name} - ${place.rating || 0} ⭐ (${place.user_ratings_total || 0} reseñas)`
                  };
                });
                
                setRestaurants(receivedRestaurants);
                setShowResultsPanel(true);
                setCurrentPage(1);
                console.log('✅ Panel de resultados activado con nueva búsqueda');
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
          // Extraer restaurantes del mensaje si no se recibieron por metadata
          if (receivedRestaurants.length === 0) {
            const extractedRestaurants = extractRestaurants(lastMessage.content);
            if (extractedRestaurants.length > 0) {
              setRestaurants(extractedRestaurants);
              setShowResultsPanel(true);
              console.log('✅ Restaurantes extraídos del texto del asistente:', extractedRestaurants.length);
            }
          }

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

  // Limpiar todo cuando se sale de la página
  const handleBack = () => {
    sessionStorage.removeItem('chatIA_state');
    setMessages([
      {
        role: "assistant",
        content: "¡Hola! 👋 Soy Sabor Capital, tu experto en restaurantes de Bogotá 🍽️✨\n\n¿Qué tipo de comida te apetece hoy? Puedo recomendarte lugares increíbles con toda la información que necesitas, incluyendo ubicación exacta 📍",
        timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setRestaurants([]);
    setShowResultsPanel(false);
    setCurrentConversationId(null);
    navigate(-1);
  };

  return (
    <div className="flex h-full bg-background">
      {/* Panel izquierdo - Chat */}
      <div className={`flex flex-col transition-all duration-300 ${showResultsPanel ? 'w-1/2' : 'w-full'} border-r border-border`}>
        <div className="flex-1 overflow-hidden">
          <div className="p-6 h-full flex flex-col">
            {/* Encabezado del chat con botón de volver */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="h-8 w-8 p-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
                ¡Hola! Soy Sabor Capital 🍽️
              </h1>
              <p className="text-sm text-muted-foreground">
                Tu asistente experto para encontrar los mejores restaurantes de Bogotá
              </p>
            </div>

            {/* Loading para historial */}
            {isLoadingHistory && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  Cargando conversación desde el historial...
                </p>
              </div>
            )}

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
                  disabled={isLoading || isLoadingHistory}
                />
                <Button
                  onClick={handleSend}
                  disabled={isLoading || isLoadingHistory || !inputMessage.trim()}
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

                          {restaurant.type && (
                            <Badge variant="secondary" className="mb-2 text-xs">
                              {restaurant.type}
                            </Badge>
                          )}

                          {restaurant.address && (
                            <div className="flex items-start gap-2 text-xs text-muted-foreground mb-2">
                              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span className="line-clamp-2">{restaurant.address}</span>
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
                          </div>
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