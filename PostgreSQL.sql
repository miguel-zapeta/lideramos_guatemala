CREATE TABLE rol (
    id_rol             SERIAL PRIMARY KEY,
    nombre             VARCHAR(50) NOT NULL UNIQUE,
    descripcion        VARCHAR(255),
    estado             BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE usuario (
    id_usuario      SERIAL PRIMARY KEY,
    id_rol          INTEGER NOT NULL,
    nombre_usuario  VARCHAR(50) NOT NULL UNIQUE,
	nombre          VARCHAR(50) NOT NULL,
	apellido        VARCHAR(50) NOT NULL,
    contrasena      VARCHAR(255) NOT NULL,
    correo          VARCHAR(150) NOT NULL,
    estado          BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_usuario_rol
        FOREIGN KEY (id_rol)
        REFERENCES rol(id_rol)
        ON DELETE RESTRICT
);

CREATE TABLE permiso (
    id_Permiso            SERIAL PRIMARY KEY,
	nombre                VARCHAR(100) NOT NULL UNIQUE,
	descripcion           VARCHAR(255),
	estado                BOOLEAN NOT NULL DEFAULT TRUE
	);

CREATE TABLE rol_permiso(
    id_rol       INTEGER NOT NULL,
	id_permiso   INTEGER NOT NULL,

	PRIMARY KEY (id_rol, id_permiso),

	CONSTRAINT fk_rol_permiso_rol
	    FOREIGN KEY (id_rol)
		REFERENCES rol(id_rol)
		ON DELETE CASCADE,

	CONSTRAINT fk_rol_permiso_permiso
	    FOREIGN KEY (id_permiso)
		REFERENCES permiso(id_permiso)
		ON DELETE CASCADE
);

CREATE TABLE proyecto (
    id_proyecto                              SERIAL PRIMARY KEY,
    nombre                                   VARCHAR(150) NOT NULL,
    fecha_inicio                             DATE,
    fecha_finalizacion                       DATE,
    estado                                   VARCHAR(20) NOT NULL DEFAULT 'planeado',
	total_gastos_ejecutados                  NUMERIC(14,2) NOT NULL DEFAULT 0,
	gestora_del_proyecto                     VARCHAR(255),
	ente_patrocinador                        VARCHAR(255),
	asociacion_gestora                       VARCHAR(255),

	CONSTRAINT chk_proyecto_ejecutado 
		CHECK (total_gastos_ejecutados >= 0), 

	CONSTRAINT chk_proyecto_estado
		CHECK (estado IN ('planeado', 'en proceso', 'finalizado'))
);

CREATE TABLE actividad (
    id_actividad         SERIAL PRIMARY KEY,
    id_proyecto          INTEGER NOT NULL,
    nombre               VARCHAR(150) NOT NULL,
	tema                 VARCHAR(150) NOT NULL,
    fecha                DATE NOT NULL,
    numero_asistentes    INTEGER NOT NULL,
    responsable          VARCHAR(150) NOT NULL,
	realizado_por        VARCHAR(150) NOT NULL,
	ninos                INTEGER,
	ninas                INTEGER,
	adolescentes_h       INTEGER,
	adolescentes_m       INTEGER,
	adultos              INTEGER,
	eje                  VARCHAR(150) NOT NULL,
	resumen_evento       VARCHAR(255),
	enlace_en_redes      VARCHAR(255),
	lugar                VARCHAR(255),
	grupo_beneficiado    VARCHAR(150),
	temas_centrales      VARCHAR(255),
	duracion             VARCHAR(150),
	objetivos            VARCHAR(255),
	resultados           VARCHAR(255),
	aportes_del_evento   VARCHAR(255),
	comentario           VARCHAR(255),
	materiales           VARCHAR(150),
	alimentos            VARCHAR(150),
	url_foto             VARCHAR(255),
    estado               BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_actividad_proyecto
        FOREIGN KEY (id_proyecto)
        REFERENCES proyecto(id_proyecto)
        ON DELETE SET NULL
);

CREATE TABLE rubro (
    id_rubro           SERIAL PRIMARY KEY,
    nombre             VARCHAR(100) NOT NULL UNIQUE,
    descripcion        VARCHAR(255),
	estado             BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE patrocinador (
    id_patrocinador     SERIAL PRIMARY KEY,
    tipo                VARCHAR(20) NOT NULL,
    nombre_razon_social VARCHAR(150) NOT NULL,
    dpi                 BIGINT,
    persona_contacto    VARCHAR(100),
    telefono            BIGINT,
    correo              VARCHAR(150),
    direccion           VARCHAR(255),
    municipio           VARCHAR(30),
    pais                VARCHAR(50),
    fecha_registro      DATE NOT NULL DEFAULT CURRENT_DATE,
    observaciones       VARCHAR(255),
    estado              BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT chk_patrocinador_tipo
        CHECK (tipo IN ('persona', 'empresa'))
);

CREATE TABLE proyecto_patrocinador (
    id_proyecto_patrocinador       SERIAL PRIMARY KEY,
    id_proyecto                    INTEGER NOT NULL,
    id_patrocinador                INTEGER NOT NULL,
    tipo_moneda                    VARCHAR(10),
    tipo_aporte                    VARCHAR(20),
    tipo_cambio                    NUMERIC(14,2) NOT NULL DEFAULT 0,
    fecha_tipo_cambio              DATE,
    fuente_tipo_cambio             VARCHAR(255),
    subvencion_moneda_donante      NUMERIC(14,2) NOT NULL DEFAULT 0,
    cantidad_solicitada_moneda_donante NUMERIC(14,2) NOT NULL DEFAULT 0,
    subvencion_moneda_nacional     NUMERIC(14,2) NOT NULL DEFAULT 0,
    diferencia_solicitado_subvencion NUMERIC(14,2) NOT NULL DEFAULT 0,
    estado                         BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_pp_proyecto
        FOREIGN KEY (id_proyecto)
        REFERENCES proyecto(id_proyecto)
        ON DELETE RESTRICT,

    CONSTRAINT fk_pp_patrocinador
        FOREIGN KEY (id_patrocinador)
        REFERENCES patrocinador(id_patrocinador)
        ON DELETE RESTRICT,

    CONSTRAINT chk_pp_moneda
        CHECK (
            tipo_moneda IS NULL OR
            tipo_moneda IN ('GTQ', 'USD', 'EUR', 'CAD', 'MXN')
        ),

    CONSTRAINT chk_pp_aporte
        CHECK (
            tipo_aporte IS NULL OR
            tipo_aporte IN ('efectivo', 'transferencia', 'cheque')
        ),

    CONSTRAINT chk_pp_tipo_cambio
        CHECK (tipo_cambio >= 0),

    CONSTRAINT chk_pp_subvencion_donante
        CHECK (subvencion_moneda_donante >= 0),

    CONSTRAINT chk_pp_solicitado_donante
        CHECK (cantidad_solicitada_moneda_donante >= 0)
);

CREATE TABLE categoria_gasto (
    id_categoria       SERIAL PRIMARY KEY,
	id_rubro           INTEGER NOT NULL,
    nombre             VARCHAR(100) NOT NULL UNIQUE,
    descripcion        VARCHAR(255),
	estado             BOOLEAN NOT NULL DEFAULT TRUE,

	CONSTRAINT fk_categoria_rubro
        FOREIGN KEY (id_rubro)
        REFERENCES rubro(id_rubro)
        ON DELETE RESTRICT
);

CREATE TABLE gasto (
    id_gasto                     SERIAL PRIMARY KEY,
    id_proyecto                  INTEGER NOT NULL,
    id_categoria                 INTEGER NOT NULL,
	numero                       NUMERIC(15,2) NOT NULL,
    fecha                        DATE NOT NULL,
	numero_documento             NUMERIC(14,2) NOT NULL,
    serie                        VARCHAR(200) NOT NULL,
	tipo_documento               VARCHAR(150),
	razon_denominacion_social    VARCHAR(255),
	descripcion                  VARCHAR(255),
	valor_base                   NUMERIC(14,2) DEFAULT 0,
	iva                          NUMERIC(14,2) DEFAULT 0,
	otros_impuestos              NUMERIC(14,2) DEFAULT 0,
    monto                        NUMERIC(14,2) NOT NULL,
	trayecto                     VARCHAR(200),
	numero_comprobante           NUMERIC(14,2),
	proveedor                    VARCHAR(200),
	total_valor_base             NUMERIC(14,2) DEFAULT 0,
	total_del_gasto              NUMERIC(10,2) DEFAULT 0,
    estado                       BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_gasto_proyecto
        FOREIGN KEY (id_proyecto)
        REFERENCES proyecto(id_proyecto)
        ON DELETE RESTRICT,

    CONSTRAINT fk_gasto_categoria
        FOREIGN KEY (id_categoria)
        REFERENCES categoria_gasto(id_categoria)
        ON DELETE RESTRICT
);

CREATE TABLE gasto_esperado (
    id_gasto_esperado                     SERIAL PRIMARY KEY,
    id_proyecto                           INTEGER NOT NULL,
    id_categoria                          INTEGER NOT NULL,
	costo_por_unidad_moneda_local         NUMERIC(14,2) NOT NULL DEFAULT 0,
	numero_de_unidades                    NUMERIC(14,2) NOT NULL DEFAULT 0,
	monto_solicitado_rise_up_moneda_local NUMERIC(14,2) NOT NULL DEFAULT 0,
	monto_solicitado_rise_up_usd          NUMERIC(14,2) NOT NULL DEFAULT 0,
    estado                                BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_gasto_proyecto
        FOREIGN KEY (id_proyecto)
        REFERENCES proyecto(id_proyecto)
        ON DELETE RESTRICT,

    CONSTRAINT fk_gasto_categoria
        FOREIGN KEY (id_categoria)
        REFERENCES categoria_gasto(id_categoria)
        ON DELETE RESTRICT,
		
	CONSTRAINT chk_gasto_costo 
		CHECK (costo_por_unidad_moneda_local >= 0),
	
	CONSTRAINT chk_gasto_unidades
		CHECK (numero_de_unidades >= 0),
	
	CONSTRAINT chk_gasto_solicitado
		CHECK (monto_solicitado_rise_up_moneda_local >= 0),
	
	CONSTRAINT chk_gasto_solicitadousd
		CHECK (monto_solicitado_rise_up_usd >= 0)
);

CREATE TABLE persona (
    id_persona                SERIAL PRIMARY KEY,
    nombres                   VARCHAR(100) NOT NULL,
    apellidos                 VARCHAR(100) NOT NULL,
    edad                      INTEGER,
	dpi                       BIGINT,
    municipio                 VARCHAR(30),
    telefono                  INTEGER,
    centro_educativo          VARCHAR(200),
	jornada                   VARCHAR(50),
	encargado                 VARCHAR(100),
	telefono_encargado        INTEGER,
	dpi_del_encargado         BIGINT,
	carta_compromiso          VARCHAR(50),
	carta_medios_comunicacion VARCHAR(50),
	dpi18                     VARCHAR(50),
	certificado_nacimiento    VARCHAR(50),
    dpi_encargado             VARCHAR(50),
    fecha_nacimiento          DATE,
    biografia                 VARCHAR(250),
    estado                    BOOLEAN NOT NULL DEFAULT TRUE,


	CONSTRAINT chk_persona_edad 
		CHECK (edad >= 0)
);

CREATE TABLE proyecto_persona (
    id_proyecto INTEGER NOT NULL,
    id_persona  INTEGER NOT NULL,

    PRIMARY KEY (id_proyecto, id_persona),

    CONSTRAINT fk_proyecto_persona_proyecto
        FOREIGN KEY (id_proyecto)
        REFERENCES proyecto(id_proyecto)
        ON DELETE CASCADE,

    CONSTRAINT fk_proyecto_persona_persona
        FOREIGN KEY (id_persona)
        REFERENCES persona(id_persona)
        ON DELETE CASCADE
);

CREATE TABLE persona_archivo (
    id_persona INTEGER NOT NULL,
    id_archivo INTEGER NOT NULL,
    campo      VARCHAR(50) NOT NULL,

    PRIMARY KEY (id_persona, id_archivo),

    CONSTRAINT fk_persona_archivo_persona
        FOREIGN KEY (id_persona)
        REFERENCES persona(id_persona)
        ON DELETE CASCADE,

    CONSTRAINT fk_persona_archivo_archivo
        FOREIGN KEY (id_archivo)
        REFERENCES archivo(id_archivo)
        ON DELETE CASCADE,

    CONSTRAINT chk_persona_archivo_campo
        CHECK (campo IN (
            'dpi18',
            'certificado_nacimiento',
            'carta_compromiso',
            'carta_medios_comunicacion',
            'dpi_encargado',
            'foto'
        ))
);

CREATE TABLE asistencia (
    id_actividad INTEGER NOT NULL,
    id_persona   INTEGER NOT NULL,

    PRIMARY KEY (id_actividad, id_persona),

    CONSTRAINT fk_asistencia_actividad
        FOREIGN KEY (id_actividad)
        REFERENCES actividad(id_actividad)
        ON DELETE CASCADE,

    CONSTRAINT fk_asistencia_persona
        FOREIGN KEY (id_persona)
        REFERENCES persona(id_persona)
        ON DELETE CASCADE
);

CREATE TABLE archivo(
	id_archivo        SERIAL PRIMARY KEY,
	nombre_archivo    VARCHAR(255) NOT NULL,
	tipo_mime         VARCHAR(100) NOT NULL,
	extension_        VARCHAR(20),
	tamano_bytes      BIGINT NOT NULL,
	contenido         BYTEA NOT NULL,
	descripcion       VARCHAR(255),
	fecha_subida      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	id_usuario        INTEGER,
	comprimido        BOOLEAN NOT NULL DEFAULT FALSE,
	tamano_comprimido BIGINT,

	CONSTRAINT fk_archivo_usuario
		FOREIGN KEY (id_usuario)
		REFERENCES usuario(id_usuario)
		ON DELETE SET NULL,

	CONSTRAINT chk_archivo_tamano 
		CHECK (tamano_bytes >= 0)
);

CREATE TABLE proyecto_archivo ( 
	id_proyecto INTEGER NOT NULL, 
	id_archivo INTEGER NOT NULL, 
	
	PRIMARY KEY (id_proyecto, id_archivo), 
	
	CONSTRAINT fk_proyecto_archivo_proyecto 
		FOREIGN KEY (id_proyecto) 
		REFERENCES proyecto(id_proyecto) 
		ON DELETE CASCADE, 
		
	CONSTRAINT fk_proyecto_archivo_archivo 
		FOREIGN KEY (id_archivo) 
		REFERENCES archivo(id_archivo) 
		ON DELETE CASCADE 
);

CREATE TABLE actividad_archivo ( 
	id_actividad INTEGER NOT NULL, 
	id_archivo INTEGER NOT NULL, 
	
	PRIMARY KEY (id_actividad, id_archivo), 
	
	CONSTRAINT fk_actividad_archivo_actividad 
		FOREIGN KEY (id_actividad) 
		REFERENCES actividad(id_actividad) 
		ON DELETE CASCADE, 
	
	CONSTRAINT fk_actividad_archivo_archivo 
		FOREIGN KEY (id_archivo) 
		REFERENCES archivo(id_archivo) 
		ON DELETE CASCADE 
);

INSERT INTO rol (
    nombre,
    descripcion
)
VALUES
(
    'Administrador',
    'Acceso completo al sistema'
),
(
    'Contador',
    'Gestión financiera y generación de reportes'
),
(
    'Tecnico',
    'Acceso limitado al sistema'
)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO permiso (
    nombre,
    descripcion
)
VALUES
('usuarios.ver', 'Ver usuarios'),
('usuarios.crear', 'Crear usuarios'),
('usuarios.editar', 'Editar usuarios'),
('usuarios.eliminar', 'Eliminar usuarios'),

('finanzas.ver', 'Ver información financiera'),
('finanzas.crear', 'Crear registros financieros'),
('finanzas.editar', 'Editar registros financieros'),
('finanzas.eliminar', 'Eliminar registros financieros'),

('proyectos.ver', 'Ver proyectos'),
('proyectos.crear', 'Crear proyectos'),
('proyectos.editar', 'Editar proyectos'),
('proyectos.eliminar', 'Eliminar proyectos'),

('actividades.ver', 'Ver actividades'),
('actividades.crear', 'Crear actividades'),
('actividades.editar', 'Editar actividades'),
('actividades.eliminar', 'Eliminar actividades'),

('voluntarios.ver', 'Ver voluntarios'),
('voluntarios.crear', 'Crear voluntarios'),
('voluntarios.editar', 'Editar voluntarios'),
('voluntarios.eliminar', 'Eliminar voluntarios'),

('reportes.ver', 'Ver reportes'),
('reportes.crear', 'Generar reportes'),
('reportes.eliminar', 'Eliminar reportes'),

('publicaciones.ver', 'Ver publicaciones'),
('publicaciones.crear', 'Crear publicaciones'),
('publicaciones.editar', 'Editar publicaciones'),
('publicaciones.eliminar', 'Eliminar publicaciones'),

('configuracion.ver', 'Ver configuración'),
('configuracion.editar', 'Modificar configuración')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT
    r.id_rol,
    p.id_permiso
FROM rol r
JOIN permiso p
    ON p.nombre IN (
		'usuarios.ver',
		'usuarios.crear',
		'usuarios.editar',
		'usuarios.eliminar',
		'actividades.ver',
		'actividades.crear',
		'actividades.editar',
		'actividades.eliminar',
		'voluntarios.ver',
		'voluntarios.crear',
		'voluntarios.editar',
		'voluntarios.eliminar',
        'finanzas.ver',
        'proyectos.ver',
        'reportes.ver',
        'reportes.crear',
		'reportes.eliminar',
		'publicaciones.ver',
		'publicaciones.crear',
		'publicaciones.editar',
		'publicaciones.eliminar',
		'configuracion.ver',
		'configuracion.editar'
    )
WHERE r.nombre = 'administrador'
ON CONFLICT DO NOTHING;

INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT
    r.id_rol,
    p.id_permiso
FROM rol r
JOIN permiso p
    ON p.nombre IN (
        'finanzas.ver',
        'finanzas.crear',
        'finanzas.editar',
        'finanzas.eliminar',
        'proyectos.ver',
        'proyectos.crear',
        'proyectos.editar',
		'proyectos.eliminar',
        'reportes.ver',
        'reportes.crear'
		'reportes.eliminar',
		'publicaciones.ver',
		'publicaciones.crear',
		'publicaciones.editar',
		'publicaciones.eliminar',
		'configuracion.ver',
		'configuracion.editar'
    )
WHERE r.nombre = 'Contador'
ON CONFLICT DO NOTHING;

INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT
    r.id_rol,
    p.id_permiso
FROM rol r
JOIN permiso p
    ON p.nombre IN (
        'actividades.ver',
        'actividades.crear',
        'actividades.editar',
        'voluntarios.ver',
		'voluntarios.crear',
		'voluntarios.editar',
        'reportes.ver',
		'reportes.crear',
		'configuracion.ver',
		'configuracion.editar'
    )
WHERE r.nombre = 'Tecnico'
ON CONFLICT DO NOTHING;

CREATE TABLE password_reset_token (
    id_token   SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expira_en  TIMESTAMPTZ NOT NULL,
    usado      BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_password_reset_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario)
        ON DELETE CASCADE
);
