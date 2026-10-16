/** Lo que se registra en Ejecuciones sobre el uso de Notion en una corrida. */
export interface Contadores {
  lecturas: number;
  escrituras: number;
  bloqueos: number;
  avisos: number;
}

/** Contador compartido por el acceso a Notion y el Escritor. */
export class Contador {
  lecturas = 0;
  escrituras = 0;
  bloqueos = 0;
  private readonly listaAvisos: string[] = [];

  avisar(aviso: string): void {
    this.listaAvisos.push(aviso);
  }

  /** Avisos registrados desde la posición indicada (ver Contadores.avisos). */
  avisosDesde(desde: number): string[] {
    return this.listaAvisos.slice(desde);
  }

  instantanea(): Contadores {
    return { lecturas: this.lecturas, escrituras: this.escrituras, bloqueos: this.bloqueos, avisos: this.listaAvisos.length };
  }
}
