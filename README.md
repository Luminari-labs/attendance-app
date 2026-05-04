# Sistema de Asistencia con QR Dinámico

Sistema seguro de control de asistencia que usa códigos QR dinámicos y validación GPS para prevenir fraudes.

## Características de Seguridad

- **QR Dinámico**: Cambia cada 5 minutos (configurable)
- **Validación GPS**: Verifica que el empleado esté en la oficina
- **Tokens JWT**: Cada QR es firmado y validado por el servidor
- **Uso Único**: Cada QR solo puede usarse una vez
- **Auditoría**: Registro completo de todas las marcas de asistencia

## Instalación Rápida

```bash
# Ejecutar script de configuración
cd /root/attendance-app
chmod +x setup.sh
./setup.sh
```

## Inicio Manual

### Backend (API)
```bash
cd /root/attendance-app/backend
npm start
```
Servidor API: http://localhost:3001

### Frontend (PWA)
```bash
cd /root/attendance-app/frontend
npm start
```
Aplicación: http://localhost:3000

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
```

## Estructura del Proyecto

```
attendance-app/
├── backend/           # API Node.js + Express
│   ├── index.js      # Servidor principal
│   ├── database.js   # Configuración SQLite
│   ├── qr.js         # Generación/validación QR
│   ├── geofence.js   # Validación de ubicación
│   └── .env          # Configuración
├── frontend/         # React PWA
│   ├── src/
│   │   ├── components/  # Login, Dashboard, Admin
│   │   └── context/     # Autenticación
│   └── public/
└── setup.sh          # Script de configuración
```

## Prevención de Fraudes

- Los QR expiran en 5 minutos
- Cada QR es de un solo uso
- Se valida que el empleado esté físicamente en la oficina (GPS)
- Los tokens QR están firmados criptográficamente
- No se pueden reutilizar tokens antiguos

## Notas para Producción

1. Cambia los secretos JWT_SECRET y QR_SECRET en `.env`
2. Usa HTTPS en producción
3. Considera usar PostgreSQL en lugar de SQLite para más de 50 usuarios
4. Configura un proxy inverso (nginx) para servir frontend y backend
