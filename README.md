# SSWAP — Sistema de Gestion Mecanica Automotriz
**Sprint 1 · MVP · Stack MERN + PostgreSQL**

Proyecto de Titulacion — PUCE TEC  
Autores: Banda J · Sarango R · Vela D

---

## Mapa de Rutas

### Publicas (sin autenticacion)
| Ruta               | Descripcion                                      |
|--------------------|--------------------------------------------------|
| `/`                | Landing page — Inicio                            |
| `/productos`       | Catalogo de productos _(Sprint 2)_               |
| `/servicios`       | Agendar servicio _(Sprint 2)_                    |
| `/nosotros`        | Informacion del taller _(Sprint 2)_              |
| `/auth`            | Login y registro de clientes                     |
| `/admin/login`     | Login exclusivo del personal del taller          |

### Panel de Administracion (solo staff)
| Ruta                      | Roles permitidos                |
|---------------------------|---------------------------------|
| `/dashboard`              | Administrador, Tecnico, Recepcionista |
| `/dashboard/inventario`   | Administrador, Tecnico, Recepcionista |
| `/dashboard/movimientos`  | Administrador, Tecnico          |

---

## Puesta en Marcha

### 1. Base de datos
```bash
psql -U postgres -c "CREATE DATABASE sswap_db;"
```

### 2. Backend
```bash
cd backend
cp .env.example .env          # Editar credenciales de PostgreSQL
npm install
npm run seed                  # Crea tablas y datos iniciales
npm run dev                   # http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
npm start                     # http://localhost:3000
```

---

## Credenciales de Prueba

### Portal de clientes → `/auth`
| Email               | Contrasena      |
|---------------------|-----------------|
| cliente@sswap.com   | Cliente@2026    |

### Panel admin → `/admin/login`
| Email               | Contrasena        | Rol           |
|---------------------|-------------------|---------------|
| admin@sswap.com     | Admin@SSWAP2026   | administrador |
| tecnico@sswap.com   | Tecnico@2026      | tecnico       |
| recepcion@sswap.com | Recepcion@2026    | recepcionista |

---

## Endpoints API

### `/api/auth`
| Metodo | Ruta        | Descripcion                  | Auth |
|--------|-------------|------------------------------|------|
| POST   | `/login`    | Login (todos los roles)      | No   |
| POST   | `/register` | Registro de clientes nuevos  | No   |
| GET    | `/me`       | Datos del usuario actual     | Si   |

### `/api/inventory`
| Metodo | Ruta                  | Descripcion                   | Roles              |
|--------|-----------------------|-------------------------------|--------------------|
| GET    | `/categorias`         | Listar categorias             | Autenticado        |
| GET    | `/repuestos`          | Listar (filtros, busqueda)    | Autenticado        |
| GET    | `/repuestos/:id`      | Detalle de repuesto           | Autenticado        |
| POST   | `/repuestos`          | Crear repuesto                | Admin              |
| PUT    | `/repuestos/:id`      | Actualizar repuesto           | Admin              |
| DELETE | `/repuestos/:id`      | Eliminar (soft delete)        | Admin              |
| POST   | `/movimientos`        | Registrar entrada/salida      | Admin, Tecnico     |
| GET    | `/movimientos`        | Historial de movimientos      | Staff              |

---

## Estructura de Carpetas

```
sswap/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js               Pool PostgreSQL
│   │   │   ├── schema.sql          DDL + seed data
│   │   │   └── seed.js             Script inicializador
│   │   ├── controllers/
│   │   │   ├── auth.controller.js  Login + Registro
│   │   │   └── inventory.controller.js
│   │   ├── middleware/
│   │   │   └── auth.middleware.js  JWT + verificarRol + soloStaff
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   └── inventory.routes.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── public/
    │   └── index.html
    └── src/
        ├── components/
        │   ├── auth/
        │   │   ├── Login.jsx            (admin legacy — no se usa en rutas)
        │   │   └── ProtectedRoute.jsx   Guard por rol
        │   ├── inventory/
        │   │   ├── ModalRepuesto.jsx
        │   │   └── ModalMovimiento.jsx
        │   ├── layout/
        │   │   └── Layout.jsx           Sidebar admin
        │   └── public/
        │       ├── Navbar.jsx           Navegacion publica
        │       └── Footer.jsx           Pie de pagina
        ├── context/
        │   ├── AuthContext.jsx          Estado global de auth
        │   └── ThemeContext.jsx         Dark / Light mode
        ├── pages/
        │   ├── Dashboard.jsx            Panel principal admin
        │   ├── Inventario.jsx           CRUD repuestos
        │   ├── Movimientos.jsx          Historial movimientos
        │   └── public/
        │       ├── Home.jsx             Landing page
        │       ├── AuthPage.jsx         Login + Registro clientes
        │       └── AdminLogin.jsx       Login personal del taller
        ├── services/
        │   └── api.js                   Axios + interceptor JWT
        ├── styles/
        │   └── global.css              Tokens CSS (Bebas Neue, Outfit, acento gold)
        ├── App.jsx                      Router principal
        └── index.js
```

---

## Proximos Sprints

- **Sprint 2:** Ordenes de Trabajo (OT), modulo Productos y Agendar Servicio
- **Sprint 3:** Portal del cliente — seguimiento de OT, historial de vehiculos
- **Sprint 4:** Integracion chatbot Google Gemini, reportes avanzados
