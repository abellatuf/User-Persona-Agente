import type { ClaveBase } from '../../config.js';

/**
 * Estructura mínima que el agente necesita en Notion (modelo de datos de la Fase 5
 * y docs/notion-plantilla.md). Los tipos son los de la API de Notion.
 * En selecciones y estados se exigen las opciones que usa el código; el PM puede
 * agregar otras sin romper nada.
 */
export interface PropiedadEsperada {
  tipo: string;
  opciones?: readonly string[];
}

export interface BaseEsperada {
  nombre: string;
  propiedades: Record<string, PropiedadEsperada>;
}

const t = (tipo: string, opciones?: readonly string[]): PropiedadEsperada =>
  opciones ? { tipo, opciones } : { tipo };

const ETAPAS = ['Armar contexto', 'Repreguntar', 'Relevar la web', 'Sintetizar', 'Planificar validación'];

export const ESQUEMA_ESPERADO: Record<ClaveBase, BaseEsperada> = {
  configuracion: {
    nombre: 'Configuración',
    propiedades: {
      Nombre: t('title'),
      'Agente activo': t('checkbox'),
      'Modelo principal': t('rich_text'),
      'Modelo de respaldo': t('rich_text'),
      Idioma: t('rich_text'),
    },
  },
  equipo: {
    nombre: 'Equipo',
    propiedades: {
      Nombre: t('title'),
      Rol: t('select', ['PM', 'Diseño', 'Ingeniería', 'Negocio', 'Otro']),
      'Persona de Notion': t('people'),
      Entrevistas: t('relation'),
    },
  },
  contexto: {
    nombre: 'Contexto del producto',
    propiedades: {
      Nombre: t('title'),
      Estado: t('status', ['Por confirmar', 'Confirmado']),
      Idioma: t('rich_text'),
      'Documentos fuente': t('files'),
      'URL fuente': t('url'),
      Problema: t('rich_text'),
      'Problema · fuente': t('rich_text'),
      'Propuesta de valor': t('rich_text'),
      'Propuesta de valor · fuente': t('rich_text'),
      'Usuarios que creemos tener': t('rich_text'),
      'Usuarios · fuente': t('rich_text'),
      Mercado: t('rich_text'),
      'Mercado · fuente': t('rich_text'),
      'Modelo de negocio': t('rich_text'),
      'Modelo de negocio · fuente': t('rich_text'),
      Competidores: t('rich_text'),
      'Competidores · fuente': t('rich_text'),
    },
  },
  solicitudes: {
    nombre: 'Solicitudes',
    propiedades: {
      Solicitud: t('title'),
      Etapa: t('select', ETAPAS),
      Estado: t('status', ['Pendiente', 'En curso', 'Lista', 'Error']),
      Opciones: t('rich_text'),
      'Pedido por': t('people'),
      Ejecuciones: t('relation'),
      Creada: t('created_time'),
    },
  },
  entrevistas: {
    nombre: 'Entrevistas',
    propiedades: {
      Entrevista: t('title'),
      Miembro: t('relation'),
      'Respuestas del formulario base': t('rich_text'),
      Estado: t('status', ['Pendiente', 'Base respondida', 'Repreguntas pendientes', 'Completa']),
      Evidencia: t('relation'),
      Creada: t('created_time'),
    },
  },
  ejecuciones: {
    nombre: 'Ejecuciones',
    propiedades: {
      'Ejecución': t('title'),
      Etapa: t('select', ['Verificar espacio', ...ETAPAS]),
      Solicitud: t('relation'),
      Inicio: t('date'),
      Fin: t('date'),
      'Proveedor y modelo': t('rich_text'),
      Lecturas: t('number'),
      Escrituras: t('number'),
      Resultado: t('select', ['Lista', 'Error', 'Incompleta', 'Pausado', 'Sin pendientes']),
      Errores: t('rich_text'),
      'Intentos bloqueados': t('number'),
    },
  },
  personas: {
    nombre: 'User Personas',
    propiedades: {
      Nombre: t('title'),
      Resumen: t('rich_text'),
      'Por qué es un segmento distinto': t('rich_text'),
      Estado: t('status', ['Borrador', 'En revisión', 'Aprobada', 'Rechazada', 'Reemplazada']),
      'Versión': t('number'),
      'Versión anterior': t('relation'),
      'Versión siguiente': t('relation'),
      'Registro de cambios': t('rich_text'),
      Controles: t('rich_text'),
      'Motivo de rechazo': t('rich_text'),
      'Aprobada por': t('people'),
      Atributos: t('relation'),
      Clave: t('rich_text'),
    },
  },
  evidencia: {
    nombre: 'Evidencia',
    propiedades: {
      'Título': t('title'),
      Extracto: t('rich_text'),
      Tipo: t('select', ['Supuesto del equipo', 'Pública', 'Investigación propia']),
      Entrevista: t('relation'),
      URL: t('url'),
      'Fecha de consulta': t('date'),
      'Etapa que la creó': t('select', ['Repreguntar', 'Relevar la web', 'Formulario de investigación', 'Manual']),
      'Método de investigación': t('select'),
      Muestra: t('rich_text'),
      Atributos: t('relation'),
      Clave: t('rich_text'),
    },
  },
  atributos: {
    nombre: 'Atributos',
    propiedades: {
      'Afirmación': t('title'),
      'Categoría': t('select', ['Objetivo', 'Problema', 'Comportamiento', 'Contexto']),
      Persona: t('relation'),
      Evidencias: t('relation'),
      Confianza: t('select', ['Alta', 'Media', 'Baja']),
      Divergencia: t('checkbox'),
      Posturas: t('rich_text'),
      'Sugerencia del agente': t('rich_text'),
      'Supuesto a validar': t('relation'),
      'Editado por el PM': t('checkbox'),
      Clave: t('rich_text'),
    },
  },
  supuestos: {
    nombre: 'Supuestos a validar',
    propiedades: {
      Supuesto: t('title'),
      Atributo: t('relation'),
      'Método': t('select'),
      'Perfil a contactar': t('rich_text'),
      'Preguntas sugeridas': t('rich_text'),
      Estado: t('status', ['Pendiente', 'En validación', 'Validado', 'Refutado']),
      Clave: t('rich_text'),
    },
  },
};
