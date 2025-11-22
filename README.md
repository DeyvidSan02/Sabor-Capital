# Sabor Capital 🍽️
Proyecto de grado Politécnico Grancolombiano - Recomendación de Restaurantes mediante el uso de API'S e IA
Plataforma web gastronómica inteligente para Bogotá que combina la potencia de Google Places API con recomendaciones personalizadas de IA para descubrir los mejores restaurantes de la capital.

Creado por: Deyvid Santiago Prada Ramos, Michael Estiven Corrales Mendez, Laura Sofia Cosme

https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react
https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript
https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase

📋 Índice
Características

Demo Rápida

Stack Tecnológico

Arquitectura

Instalación

Configuración

Estructura del Proyecto

Desarrollo

Roadmap

🌟 Características
🤖 Chat IA Inteligente
Asistente conversacional con Google Gemini

Recomendaciones personalizadas basadas en preferencias del usuario

Búsqueda por lenguaje natural - "lugares románticos en Usaquén"

Respuestas enriquecidas con datos reales de Google Places

Streaming en tiempo real de respuestas

🗺️ Mapas y Geolocalización
Mapa interactivo integrado con Google Maps

Marcadores inteligentes para restaurantes y ubicación del usuario

Geolocalización automática con permiso del usuario

Filtros avanzados por tipo de comida, precio, calificación

Sincronización en tiempo real entre chat y mapa

💾 Gestión de Datos
Historial completo de conversaciones y búsquedas

Sistema de favoritos con persistencia local

Reseñas y calificaciones de usuarios

Caché inteligente de datos de restaurantes

Backup automático de conversaciones

👤 Experiencia de Usuario
Onboarding inteligente para capturar preferencias

Perfil personalizable con preferencias gastronómicas

Autenticación segura (Email + Google OAuth)

Interfaz responsive para todos los dispositivos

Tema gastronómico con colores colombianos

🎬 Demo Rápida
bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/sabor-capital
cd sabor-capital

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
La aplicación estará disponible en http://localhost:5173

🛠️ Stack Tecnológico
Frontend
React 18.3.1 - Framework principal

TypeScript - Tipado estático

Vite - Build tool y desarrollo

Tailwind CSS - Estilos y diseño

shadcn/ui - Componentes UI

React Router DOM - Navegación

TanStack Query - Gestión de estado del servidor

Backend & Infraestructura
Supabase - Base de datos PostgreSQL + Auth

Google Maps API - Mapas y lugares

Google Gemini - IA conversacional

Deno Runtime - Edge Functions

🚀 Instalación Rápida
Prerrequisitos
Node.js 18+

Cuenta de Supabase

APIs de Google (Maps, Places, Gemini)

1. Clonar el Proyecto
bash
git clone https://github.com/tu-usuario/sabor-capital
cd sabor-capital
2. Instalar Dependencias
bash
npm install
3. Configurar Variables de Entorno
bash
# Crear archivo .env
cp .env.example .env
Editar el archivo .env:

env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
4. Ejecutar en Desarrollo
bash
npm run dev
⚙️ Configuración
Configuración de Supabase
Crear un nuevo proyecto en Supabase

Ejecutar las migraciones de base de datos

Configurar Google OAuth en Authentication → Providers

Obtener las keys para el archivo .env

Configuración de Google APIs
Google Cloud Console:

Habilitar: Maps JavaScript API, Places API

Crear credenciales de API Key

Configurar restricciones de aplicación

Google Gemini AI:

Habilitar Gemini API

Generar API Key

Configurar en secrets de Supabase

📂 Estructura del Proyecto
text
sabor-capital/
├── src/
│   ├── components/          # Componentes React reutilizables
│   │   ├── layout/         # Componentes de estructura
│   │   ├── ui/             # Componentes de shadcn/ui
│   │   ├── ChatMessage.tsx # Componente de mensajes del chat
│   │   └── RestauranteCard.tsx # Tarjeta de restaurante
│   ├── hooks/              # Custom hooks
│   │   ├── useAuth.tsx     # Autenticación y usuario
│   │   ├── useChat.tsx     # Gestión del chat IA
│   │   └── useMaps.tsx     # Integración con mapas
│   ├── lib/                # Utilidades y configuración
│   │   ├── types.ts        # Tipos TypeScript
│   │   ├── utils.ts        # Funciones helper
│   │   └── validations.ts  # Esquemas de validación Zod
│   ├── pages/              # Vistas/páginas de la aplicación
│   │   ├── ChatIA.tsx      # Chat principal con IA
│   │   ├── Dashboard.tsx   # Panel de control
│   │   ├── Perfil.tsx      # Gestión de perfil de usuario
│   │   ├── Mapa.tsx        # Vista de mapa completo
│   │   ├── Favoritos.tsx   # Restaurantes favoritos
│   │   └── Onboarding.tsx  # Flujo de onboarding
│   └── integrations/
│       └── supabase/       # Configuración de Supabase
│           ├── client.ts   # Cliente configurado
│           └── types.ts    # Tipos generados
├── supabase/
│   ├── functions/          # Edge Functions
│   │   ├── chat/          # Función de chat con IA
│   │   └── places-search/ # Búsqueda en Google Places
│   └── migrations/        # Migraciones de base de datos
└── public/                # Archivos estáticos
🗄️ Base de Datos
Tablas Principales
usuario - Perfiles de usuarios con preferencias

chat_conversacion - Historial de conversaciones con IA

chat_mensaje - Mensajes individuales de cada chat

favorito - Restaurantes favoritos de usuarios

resena - Reseñas y calificaciones de restaurantes

historial_busqueda - Registro de búsquedas realizadas

Seguridad
Todas las tablas tienen Row Level Security (RLS) habilitado, asegurando que los usuarios solo puedan acceder a sus propios datos.

🛠️ Desarrollo
Comandos Disponibles
bash
# Desarrollo
npm run dev              # Servidor de desarrollo
npm run build           # Build de producción
npm run preview         # Preview del build

# Utilidades
npm run lint            # ESLint
npm run type-check      # Verificación de TypeScript
npm run format          # Formateo de código con Prettier
Estructura de Branches
text
main           → Rama de producción
develop        → Rama de desarrollo principal
feature/*      → Nuevas funcionalidades
hotfix/*       → Correcciones críticas
Guía de Contribución
Fork del repositorio

Crear una rama de feature:

bash
git checkout -b feature/nueva-caracteristica
Desarrollar y probar:

bash
npm run dev
npm run type-check
Commit semántico:

bash
git commit -m "feat: añadir sistema de reservas"
Push y crear Pull Request

📈 Roadmap
✅ Completado (Q4 2024)
Arquitectura base del proyecto

Sistema de autenticación (Email + Google)

Integración con Google Maps y Places API

Chat IA con Google Gemini

Sistema de perfiles de usuario

Historial de conversaciones y búsquedas

Sistema de favoritos y reseñas

🚧 En Desarrollo
Sistema de reservas de restaurantes

Notificaciones push

Modo offline con PWA

Dashboard de analytics

📅 Planeado
App móvil con React Native

Sistema de recomendaciones con ML

Integración con apps de delivery

Programa de fidelización

🐛 Solución de Problemas
Problemas Comunes
Error de conexión con Supabase:

Verificar las variables de entorno

Confirmar que el proyecto de Supabase esté activo

Mapa no carga:

Verificar la API Key de Google Maps

Confirmar que las APIs estén habilitadas

Chat IA no responde:

Verificar la API Key de Gemini

Revisar los logs de Edge Functions

Logs y Debug
bash
# Ver logs en desarrollo
npm run dev

# Revisar la consola del navegador para errores
# Verificar Network tab para peticiones fallidas
📄 Licencia
Este proyecto es de uso académico y educativo. Desarrollado como parte de un proyecto universitario.

Desarrollado con ❤️ por Deyvid Santiago Prada Ramos, Michael Estiven Corrales Mendez, Laura Sofia Cosme
