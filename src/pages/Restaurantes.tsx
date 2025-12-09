import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RestauranteCard } from "@/components/RestauranteCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useRestaurants, getPhotoUrl, formatPriceLevel } from "@/hooks/useRestaurants";

const Restaurantes = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const { data: restaurantes, isLoading, error } = useRestaurants(20);

  const handleRestauranteClick = (placeId: string) => {
    navigate(`/restaurantes/${placeId}`);
  };

  return (
    <div className="min-h-full p-6 bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Restaurantes</h1>
            <p className="text-muted-foreground mt-1">
              Descubre los mejores restaurantes de Bogotá
            </p>
          </div>
          <Button
            onClick={() => setShowRecommendationModal(true)}
            className="gap-2"
            size="lg"
          >
            <Sparkles className="h-4 w-4" />
            Recomiéndame algo
          </Button>
        </div>

        {/* Filtros */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 p-4 bg-card border border-border rounded-lg">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  Tipo de comida {filters.cuisine && filters.cuisine.length > 0 && `(${filters.cuisine.length})`}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 max-h-96 overflow-y-auto">
                <DropdownMenuLabel>Seleccionar tipo</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {cuisines.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    No hay tipos de cocina disponibles
                  </div>
                ) : (
                  cuisines.map(cuisine => (
                    <DropdownMenuCheckboxItem 
                      key={cuisine.name}
                      checked={filters.cuisine?.includes(cuisine.name)}
                      onCheckedChange={() => toggleFilter("cuisine", cuisine.name)}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{cuisine.displayName}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {cuisine.count}
                        </Badge>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  Precio {filters.priceLevel && filters.priceLevel.length > 0 && `(${filters.priceLevel.length})`}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Rango de precio</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {priceLevels.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    No hay rangos de precio disponibles
                  </div>
                ) : (
                  priceLevels.map(priceLevel => (
                    <DropdownMenuCheckboxItem 
                      key={priceLevel.level}
                      checked={filters.priceLevel?.includes(priceLevel.level)}
                      onCheckedChange={() => toggleFilter("priceLevel", priceLevel.level)}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{priceLevel.displayName}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {priceLevel.count}
                        </Badge>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  Ubicación {filters.neighborhood && filters.neighborhood.length > 0 && `(${filters.neighborhood.length})`}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 max-h-96 overflow-y-auto">
                <DropdownMenuLabel>Zona</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {neighborhoods.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    No hay zonas disponibles
                  </div>
                ) : (
                  neighborhoods.map(neighborhood => (
                    <DropdownMenuCheckboxItem 
                      key={neighborhood.name}
                      checked={filters.neighborhood?.includes(neighborhood.name)}
                      onCheckedChange={() => toggleFilter("neighborhood", neighborhood.name)}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="truncate max-w-[150px]">{neighborhood.name}</span>
                        <Badge variant="secondary" className="ml-2 text-xs shrink-0">
                          {neighborhood.count}
                        </Badge>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  Calificación {filters.minRating && "(1)"}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                <DropdownMenuLabel>Mínima</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem 
                  checked={filters.minRating === 4.5}
                  onCheckedChange={() => toggleFilter("minRating", 4.5)}
                >
                  4.5+ estrellas
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem 
                  checked={filters.minRating === 4.0}
                  onCheckedChange={() => toggleFilter("minRating", 4.0)}
                >
                  4.0+ estrellas
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem 
                  checked={filters.minRating === 3.5}
                  onCheckedChange={() => toggleFilter("minRating", 3.5)}
                >
                  3.5+ estrellas
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  Disponibilidad {filters.openNow && "(1)"}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                <DropdownMenuLabel>Horario</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem 
                  checked={filters.openNow === true}
                  onCheckedChange={() => toggleFilter("openNow", true)}
                >
                  Abierto ahora
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {activeFiltersCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Limpiar filtros ({activeFiltersCount})
              </Button>
            )}
          </div>

          {/* Contador de resultados */}
          {!isLoading && allRestaurants && (
            <p className="text-sm text-muted-foreground px-1">
              Mostrando {allRestaurants.length} de {totalCount} restaurantes
              {isFetchingNextPage && " (cargando más...)"}
            </p>
          )}
        </div>

        {/* Grid de Restaurantes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))
          ) : error ? (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">
                Error al cargar restaurantes. Por favor intenta de nuevo.
              </p>
            </div>
          ) : !restaurantes || restaurantes.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">
                No se encontraron restaurantes. Intenta realizar una búsqueda primero.
              </p>
            </div>
          ) : (
            restaurantes.map((restaurante) => {
              const photoUrl = restaurante.photos && restaurante.photos.length > 0
                ? getPhotoUrl(restaurante.photos[0], 400)
                : "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop";
              
              const tipo = restaurante.types && restaurante.types.length > 0
                ? restaurante.types[0].replace(/_/g, " ")
                : "Restaurante";

              return (
                <div
                  key={restaurante.id}
                  onClick={() => handleRestauranteClick(restaurante.place_id)}
                >
                  <RestauranteCard
                    nombre={restaurante.name}
                    imagen={photoUrl}
                    calificacion={restaurante.rating || 0}
                    precio={formatPriceLevel(restaurante.price_level)}
                    tipo={tipo}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Loading indicator para scroll infinito */}
        {isFetchingNextPage && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Cargando más restaurantes...</span>
          </div>
        )}

        {/* Elemento invisible para activar la carga */}
        {hasNextPage && !isFetchingNextPage && (
          <div ref={loadMoreRef} className="h-20" />
        )}

        {/* Mensaje cuando ya no hay más resultados */}
        {!hasNextPage && allRestaurants.length > 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">
              Has visto todos los restaurantes disponibles ({totalCount} en total)
            </p>
          </div>
        )}
      </div>

      {/* Modal de recomendación rápida */}
      <QuickRecommendationModal
        open={showRecommendationModal}
        onOpenChange={setShowRecommendationModal}
        restaurants={allRestaurants || []}
        currentFilters={filters}
      />
    </div>
  );
};

export default Restaurantes;
