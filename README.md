# Sistema de Asistencia con QR Dinámico

Sistema seguro de control de asistencia que usa códigos QR dinámicos y validación GPS para prevenir fraudes.

## Características de Seguridad

- **QR Dinámico**: Cambia cada 5 minutos (configurable)
- **Validación GPS**: Verifica que el empleado esté en la oficina
- **Tokens JWT**: Cada QR es firmado y validado por el servidor
- **Uso Único**: Cada QR solo puede usarse una vez
- **Auditoría**: Registro completo de todas las marcas de asistencia

## Despliegue con Dokploy

Este proyecto está configurado para desplegarse como un **servicio único** desde un solo repositorio usando Dokploy.

### Pasos para despliegue:

1. **Conecta tu repositorio** a Dokploy
2. **Configura las variables de entorno** en Dokploy:
   ```
   NODE_ENV=production
   PORT=3001
   JWT_SECRET=tu_clave_secreta_jwt_muy_segura
   QR_SECRET=tu_clave_secreta_qr_muy_segura
   OFFICE_LAT=19.4326
   OFFICE_LNG=-99.1332
   OFFICE_RADIUS_METERS=100
   ```
3. **Dokploy detectará automáticamente** el `Dockerfile` en la raíz
4. **El backend sirve automáticamente el frontend** - No necesitas servicios separados

### Arquitectura de Despliegue

```
Usuario → Dokploy (Puerto 3001) → Backend (API) + Frontend (React build)
```

## Instalación Local

```bash
# Ejecutar script de configuración
cd /root/attendance-app
chmod +x setup.sh
./setup.sh
```

### Inicio Local

```bash
cd /root/attendance-app/backend
npm start
```
Aplicación completa: http://localhost:3001

## Credenciales por Defecto

- **Admin**: admin@company.com / admin123
- **Empleado**: Regístrate desde la página de login

## Flujo de Uso

1. **Admin**: Genera un nuevo código QR desde el panel de administración
2. **Empleado**: 
   - Abre la app en su teléfono
   - Selecciona "Entrada" o "Salida"
   - Escanea el código QR mostrado por el admin
   - La app captura su ubicación GPS automáticamente
   - Se registra la asistencia si está dentro del radio de la oficina

## Configuración

Edita `/root/attendance-app/backend/.env`:

```
PORT=3001
JWT_SECRET=tu_clave_secreta_jwt
QR_SECRET=tu_clave_secreta_qr
QR_VALIDITY_MINUTES=5
OFFICE_LAT=19.4326
OFFICE_LNG=-99.1332
OFFICE_RADIUS_METERS=100
DB_PATH=../data/attendance.db
```

## Estructura del Proyecto

```
attendance-app/
├── Dockerfile          # Configuración para Dokploy
├── .dockerignore       # Archivos excluidos del build
├── dokploy.yml         # Configuración opcional de Dokploy
├── backend/           # API Node.js + Express
│   ├── index.js      # Servidor principal (sirve frontend y API)
│   ├── database.js   # Configuración SQLite
│   ├── qr.js         # Generación/validación QR
│   ├── geofence.js   # Validación de ubicación
│   ├── config.js     # Configuración centralizada
│   └── .env          # Variables de entorno
├── frontend/         # React PWA
│   ├── build/       # Archivos estáticos (generados)
│   ├── src/
│   │   ├── components/  # Login, Dashboard, Admin
│   │   └── context/     # Autenticación
│   └── public/
└── data/             # Base de datos SQLite (persistente)
```

## Prevención de Fraudes

- Los QR expiran en 5 minutos
- Cada QR es de un solo uso
- Se valida que el empleado esté físicamente en la oficina (GPS)
- Los tokens QR están firmados criptográficamente
- No se pueden reutilizar tokens antiguos

## Notas para Producción

1. **Cambia los secretos** JWT_SECRET y QR_SECRET antes del despliegue
2. **Usa HTTPS** - Dokploy proporciona SSL automático
3. **Persistencia de datos**: Configura un volumen en Dokploy para `/app/data`
4. **Base de datos**: Para más de 50 usuarios, considera migrar a PostgreSQL
5. **Monitoreo**: Revisa los logs en el dashboard de Dokploy
