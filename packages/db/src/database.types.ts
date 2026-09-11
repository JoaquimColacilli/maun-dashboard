export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      ajustes: {
        Row: {
          costos_fijos_centavos: number;
          created_at: string;
          deleted_at: string | null;
          household_id: string;
          id: string;
          meta_cocos_centavos: number;
          perdido_con_diezmo: boolean;
          perdido_con_sueldo: boolean;
          sueldo_mensual_centavos: number;
          sueldo_tope_mensual: boolean;
          tasa_cocos_anual_bp: number;
          updated_at: string;
          version: number;
        };
        Insert: {
          costos_fijos_centavos?: number;
          created_at?: string;
          deleted_at?: string | null;
          household_id?: string;
          id?: string;
          meta_cocos_centavos?: number;
          perdido_con_diezmo?: boolean;
          perdido_con_sueldo?: boolean;
          sueldo_mensual_centavos?: number;
          sueldo_tope_mensual?: boolean;
          tasa_cocos_anual_bp?: number;
          updated_at?: string;
          version?: number;
        };
        Update: {
          costos_fijos_centavos?: number;
          created_at?: string;
          deleted_at?: string | null;
          household_id?: string;
          id?: string;
          meta_cocos_centavos?: number;
          perdido_con_diezmo?: boolean;
          perdido_con_sueldo?: boolean;
          sueldo_mensual_centavos?: number;
          sueldo_tope_mensual?: boolean;
          tasa_cocos_anual_bp?: number;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'ajustes_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: true;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      clientes: {
        Row: {
          condicion_fiscal: Database['public']['Enums']['condicion_fiscal'];
          created_at: string;
          cuit: string;
          deleted_at: string | null;
          direccion: string;
          domicilio_fiscal: string;
          email: string;
          household_id: string;
          id: string;
          nombre: string;
          notas: string;
          origen_contacto: Database['public']['Enums']['origen_contacto'] | null;
          origen_detalle: string;
          razon_social: string;
          telefono: string;
          updated_at: string;
          version: number;
          zona: string;
        };
        Insert: {
          condicion_fiscal?: Database['public']['Enums']['condicion_fiscal'];
          created_at?: string;
          cuit?: string;
          deleted_at?: string | null;
          direccion?: string;
          domicilio_fiscal?: string;
          email?: string;
          household_id?: string;
          id?: string;
          nombre: string;
          notas?: string;
          origen_contacto?: Database['public']['Enums']['origen_contacto'] | null;
          origen_detalle?: string;
          razon_social?: string;
          telefono?: string;
          updated_at?: string;
          version?: number;
          zona?: string;
        };
        Update: {
          condicion_fiscal?: Database['public']['Enums']['condicion_fiscal'];
          created_at?: string;
          cuit?: string;
          deleted_at?: string | null;
          direccion?: string;
          domicilio_fiscal?: string;
          email?: string;
          household_id?: string;
          id?: string;
          nombre?: string;
          notas?: string;
          origen_contacto?: Database['public']['Enums']['origen_contacto'] | null;
          origen_detalle?: string;
          razon_social?: string;
          telefono?: string;
          updated_at?: string;
          version?: number;
          zona?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'clientes_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      gastos: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          descripcion: string;
          fecha: string;
          household_id: string;
          id: string;
          monto_centavos: number;
          proyecto_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          descripcion?: string;
          fecha: string;
          household_id?: string;
          id?: string;
          monto_centavos: number;
          proyecto_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          descripcion?: string;
          fecha?: string;
          household_id?: string;
          id?: string;
          monto_centavos?: number;
          proyecto_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'gastos_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gastos_proyecto_fk';
            columns: ['household_id', 'proyecto_id'];
            isOneToOne: false;
            referencedRelation: 'proyectos';
            referencedColumns: ['household_id', 'id'];
          },
        ];
      };
      household_members: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          household_id: string;
          id: string;
          rol: Database['public']['Enums']['rol_household'];
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          household_id: string;
          id?: string;
          rol?: Database['public']['Enums']['rol_household'];
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          household_id?: string;
          id?: string;
          rol?: Database['public']['Enums']['rol_household'];
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      households: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          nombre: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          nombre: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          nombre?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      movimientos: {
        Row: {
          categoria: string;
          created_at: string;
          deleted_at: string | null;
          descripcion: string;
          fecha: string;
          household_id: string;
          id: string;
          monto_centavos: number;
          proyecto_id: string | null;
          tesoro_destino: Database['public']['Enums']['tesoro'] | null;
          tesoro_origen: Database['public']['Enums']['tesoro'] | null;
          tipo: Database['public']['Enums']['tipo_movimiento'];
          updated_at: string;
          version: number;
        };
        Insert: {
          categoria?: string;
          created_at?: string;
          deleted_at?: string | null;
          descripcion?: string;
          fecha: string;
          household_id?: string;
          id?: string;
          monto_centavos: number;
          proyecto_id?: string | null;
          tesoro_destino?: Database['public']['Enums']['tesoro'] | null;
          tesoro_origen?: Database['public']['Enums']['tesoro'] | null;
          tipo: Database['public']['Enums']['tipo_movimiento'];
          updated_at?: string;
          version?: number;
        };
        Update: {
          categoria?: string;
          created_at?: string;
          deleted_at?: string | null;
          descripcion?: string;
          fecha?: string;
          household_id?: string;
          id?: string;
          monto_centavos?: number;
          proyecto_id?: string | null;
          tesoro_destino?: Database['public']['Enums']['tesoro'] | null;
          tesoro_origen?: Database['public']['Enums']['tesoro'] | null;
          tipo?: Database['public']['Enums']['tipo_movimiento'];
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'movimientos_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_proyecto_fk';
            columns: ['household_id', 'proyecto_id'];
            isOneToOne: false;
            referencedRelation: 'proyectos';
            referencedColumns: ['household_id', 'id'];
          },
        ];
      };
      pagos: {
        Row: {
          concepto: string;
          created_at: string;
          deleted_at: string | null;
          fecha: string;
          household_id: string;
          id: string;
          monto_centavos: number;
          proyecto_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          concepto?: string;
          created_at?: string;
          deleted_at?: string | null;
          fecha: string;
          household_id?: string;
          id?: string;
          monto_centavos: number;
          proyecto_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          concepto?: string;
          created_at?: string;
          deleted_at?: string | null;
          fecha?: string;
          household_id?: string;
          id?: string;
          monto_centavos?: number;
          proyecto_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'pagos_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagos_proyecto_fk';
            columns: ['household_id', 'proyecto_id'];
            isOneToOne: false;
            referencedRelation: 'proyectos';
            referencedColumns: ['household_id', 'id'];
          },
        ];
      };
      proyectos: {
        Row: {
          cliente_id: string;
          comprobante: Database['public']['Enums']['comprobante'];
          created_at: string;
          deleted_at: string | null;
          descripcion: string;
          direccion_entrega: string;
          dist_cobrado_centavos: number | null;
          dist_diezmo_bp: number | null;
          dist_diezmo_centavos: number | null;
          dist_fijos_centavos: number | null;
          dist_fijos_previo_centavos: number | null;
          dist_gastos_centavos: number | null;
          dist_liquidado_at: string | null;
          dist_objetivo_fijos_centavos: number | null;
          dist_objetivo_sueldo_centavos: number | null;
          dist_remanente_centavos: number | null;
          dist_sueldo_centavos: number | null;
          dist_sueldo_mensual: boolean | null;
          dist_sueldo_previo_centavos: number | null;
          dist_tope_fijos_centavos: number | null;
          dist_tope_sueldo_centavos: number | null;
          entrega_estimada: string | null;
          estado: Database['public']['Enums']['estado_proyecto'];
          fecha_cobro: string | null;
          fecha_entrega: string | null;
          fecha_inicio: string | null;
          fecha_visita: string | null;
          forma_pago: Database['public']['Enums']['forma_pago'] | null;
          household_id: string;
          id: string;
          notas: string;
          presupuesto_centavos: number | null;
          reapertura_fecha_cobro: string | null;
          reapertura_objetivo_fijos_centavos: number | null;
          reapertura_objetivo_sueldo_centavos: number | null;
          reapertura_sueldo_mensual: boolean | null;
          titulo: string;
          ultimo_contacto: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          cliente_id: string;
          comprobante?: Database['public']['Enums']['comprobante'];
          created_at?: string;
          deleted_at?: string | null;
          descripcion?: string;
          direccion_entrega?: string;
          dist_cobrado_centavos?: number | null;
          dist_diezmo_bp?: number | null;
          dist_diezmo_centavos?: number | null;
          dist_fijos_centavos?: number | null;
          dist_fijos_previo_centavos?: number | null;
          dist_gastos_centavos?: number | null;
          dist_liquidado_at?: string | null;
          dist_objetivo_fijos_centavos?: number | null;
          dist_objetivo_sueldo_centavos?: number | null;
          dist_remanente_centavos?: number | null;
          dist_sueldo_centavos?: number | null;
          dist_sueldo_mensual?: boolean | null;
          dist_sueldo_previo_centavos?: number | null;
          dist_tope_fijos_centavos?: number | null;
          dist_tope_sueldo_centavos?: number | null;
          entrega_estimada?: string | null;
          estado?: Database['public']['Enums']['estado_proyecto'];
          fecha_cobro?: string | null;
          fecha_entrega?: string | null;
          fecha_inicio?: string | null;
          fecha_visita?: string | null;
          forma_pago?: Database['public']['Enums']['forma_pago'] | null;
          household_id?: string;
          id?: string;
          notas?: string;
          presupuesto_centavos?: number | null;
          reapertura_fecha_cobro?: string | null;
          reapertura_objetivo_fijos_centavos?: number | null;
          reapertura_objetivo_sueldo_centavos?: number | null;
          reapertura_sueldo_mensual?: boolean | null;
          titulo: string;
          ultimo_contacto?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          cliente_id?: string;
          comprobante?: Database['public']['Enums']['comprobante'];
          created_at?: string;
          deleted_at?: string | null;
          descripcion?: string;
          direccion_entrega?: string;
          dist_cobrado_centavos?: number | null;
          dist_diezmo_bp?: number | null;
          dist_diezmo_centavos?: number | null;
          dist_fijos_centavos?: number | null;
          dist_fijos_previo_centavos?: number | null;
          dist_gastos_centavos?: number | null;
          dist_liquidado_at?: string | null;
          dist_objetivo_fijos_centavos?: number | null;
          dist_objetivo_sueldo_centavos?: number | null;
          dist_remanente_centavos?: number | null;
          dist_sueldo_centavos?: number | null;
          dist_sueldo_mensual?: boolean | null;
          dist_sueldo_previo_centavos?: number | null;
          dist_tope_fijos_centavos?: number | null;
          dist_tope_sueldo_centavos?: number | null;
          entrega_estimada?: string | null;
          estado?: Database['public']['Enums']['estado_proyecto'];
          fecha_cobro?: string | null;
          fecha_entrega?: string | null;
          fecha_inicio?: string | null;
          fecha_visita?: string | null;
          forma_pago?: Database['public']['Enums']['forma_pago'] | null;
          household_id?: string;
          id?: string;
          notas?: string;
          presupuesto_centavos?: number | null;
          reapertura_fecha_cobro?: string | null;
          reapertura_objetivo_fijos_centavos?: number | null;
          reapertura_objetivo_sueldo_centavos?: number | null;
          reapertura_sueldo_mensual?: boolean | null;
          titulo?: string;
          ultimo_contacto?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'proyectos_cliente_fk';
            columns: ['household_id', 'cliente_id'];
            isOneToOne: false;
            referencedRelation: 'clientes';
            referencedColumns: ['household_id', 'id'];
          },
          {
            foreignKeyName: 'proyectos_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      libro_mayor: {
        Row: {
          asiento_id: string | null;
          categoria: string | null;
          concepto: string | null;
          contrapartida: Database['public']['Enums']['tesoro'] | null;
          descripcion: string | null;
          fecha: string | null;
          household_id: string | null;
          monto_centavos: number | null;
          origen: string | null;
          proyecto_id: string | null;
          tesoro: Database['public']['Enums']['tesoro'] | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      bootstrap: { Args: never; Returns: Json };
      cerrar_perdido: {
        Args: {
          p_cobrado_centavos: number;
          p_diezmo_bp: number;
          p_diezmo_centavos: number;
          p_fecha: string;
          p_fijos_centavos: number;
          p_gastos_centavos: number;
          p_proyecto_id: string;
          p_remanente_centavos: number;
          p_sueldo_centavos: number;
          p_tope_fijos_centavos: number;
          p_tope_sueldo_centavos: number;
          p_version: number;
        };
        Returns: {
          cliente_id: string;
          comprobante: Database['public']['Enums']['comprobante'];
          created_at: string;
          deleted_at: string | null;
          descripcion: string;
          direccion_entrega: string;
          dist_cobrado_centavos: number | null;
          dist_diezmo_bp: number | null;
          dist_diezmo_centavos: number | null;
          dist_fijos_centavos: number | null;
          dist_fijos_previo_centavos: number | null;
          dist_gastos_centavos: number | null;
          dist_liquidado_at: string | null;
          dist_objetivo_fijos_centavos: number | null;
          dist_objetivo_sueldo_centavos: number | null;
          dist_remanente_centavos: number | null;
          dist_sueldo_centavos: number | null;
          dist_sueldo_mensual: boolean | null;
          dist_sueldo_previo_centavos: number | null;
          dist_tope_fijos_centavos: number | null;
          dist_tope_sueldo_centavos: number | null;
          entrega_estimada: string | null;
          estado: Database['public']['Enums']['estado_proyecto'];
          fecha_cobro: string | null;
          fecha_entrega: string | null;
          fecha_inicio: string | null;
          fecha_visita: string | null;
          forma_pago: Database['public']['Enums']['forma_pago'] | null;
          household_id: string;
          id: string;
          notas: string;
          presupuesto_centavos: number | null;
          reapertura_fecha_cobro: string | null;
          reapertura_objetivo_fijos_centavos: number | null;
          reapertura_objetivo_sueldo_centavos: number | null;
          reapertura_sueldo_mensual: boolean | null;
          titulo: string;
          ultimo_contacto: string | null;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: '*';
          to: 'proyectos';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cobrar_proyecto: {
        Args: {
          p_cobrado_centavos: number;
          p_diezmo_centavos: number;
          p_fecha_cobro: string;
          p_fijos_centavos: number;
          p_gastos_centavos: number;
          p_proyecto_id: string;
          p_remanente_centavos: number;
          p_sueldo_centavos: number;
          p_tope_fijos_centavos: number;
          p_tope_sueldo_centavos: number;
          p_version: number;
        };
        Returns: {
          cliente_id: string;
          comprobante: Database['public']['Enums']['comprobante'];
          created_at: string;
          deleted_at: string | null;
          descripcion: string;
          direccion_entrega: string;
          dist_cobrado_centavos: number | null;
          dist_diezmo_bp: number | null;
          dist_diezmo_centavos: number | null;
          dist_fijos_centavos: number | null;
          dist_fijos_previo_centavos: number | null;
          dist_gastos_centavos: number | null;
          dist_liquidado_at: string | null;
          dist_objetivo_fijos_centavos: number | null;
          dist_objetivo_sueldo_centavos: number | null;
          dist_remanente_centavos: number | null;
          dist_sueldo_centavos: number | null;
          dist_sueldo_mensual: boolean | null;
          dist_sueldo_previo_centavos: number | null;
          dist_tope_fijos_centavos: number | null;
          dist_tope_sueldo_centavos: number | null;
          entrega_estimada: string | null;
          estado: Database['public']['Enums']['estado_proyecto'];
          fecha_cobro: string | null;
          fecha_entrega: string | null;
          fecha_inicio: string | null;
          fecha_visita: string | null;
          forma_pago: Database['public']['Enums']['forma_pago'] | null;
          household_id: string;
          id: string;
          notas: string;
          presupuesto_centavos: number | null;
          reapertura_fecha_cobro: string | null;
          reapertura_objetivo_fijos_centavos: number | null;
          reapertura_objetivo_sueldo_centavos: number | null;
          reapertura_sueldo_mensual: boolean | null;
          titulo: string;
          ultimo_contacto: string | null;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: '*';
          to: 'proyectos';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delta: { Args: { p_desde: string }; Returns: Json };
      reabrir_proyecto: {
        Args: { p_proyecto_id: string; p_version: number };
        Returns: {
          cliente_id: string;
          comprobante: Database['public']['Enums']['comprobante'];
          created_at: string;
          deleted_at: string | null;
          descripcion: string;
          direccion_entrega: string;
          dist_cobrado_centavos: number | null;
          dist_diezmo_bp: number | null;
          dist_diezmo_centavos: number | null;
          dist_fijos_centavos: number | null;
          dist_fijos_previo_centavos: number | null;
          dist_gastos_centavos: number | null;
          dist_liquidado_at: string | null;
          dist_objetivo_fijos_centavos: number | null;
          dist_objetivo_sueldo_centavos: number | null;
          dist_remanente_centavos: number | null;
          dist_sueldo_centavos: number | null;
          dist_sueldo_mensual: boolean | null;
          dist_sueldo_previo_centavos: number | null;
          dist_tope_fijos_centavos: number | null;
          dist_tope_sueldo_centavos: number | null;
          entrega_estimada: string | null;
          estado: Database['public']['Enums']['estado_proyecto'];
          fecha_cobro: string | null;
          fecha_entrega: string | null;
          fecha_inicio: string | null;
          fecha_visita: string | null;
          forma_pago: Database['public']['Enums']['forma_pago'] | null;
          household_id: string;
          id: string;
          notas: string;
          presupuesto_centavos: number | null;
          reapertura_fecha_cobro: string | null;
          reapertura_objetivo_fijos_centavos: number | null;
          reapertura_objetivo_sueldo_centavos: number | null;
          reapertura_sueldo_mensual: boolean | null;
          titulo: string;
          ultimo_contacto: string | null;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: '*';
          to: 'proyectos';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reactivar_perdido: {
        Args: {
          p_estado: Database['public']['Enums']['estado_proyecto'];
          p_proyecto_id: string;
          p_version: number;
        };
        Returns: {
          cliente_id: string;
          comprobante: Database['public']['Enums']['comprobante'];
          created_at: string;
          deleted_at: string | null;
          descripcion: string;
          direccion_entrega: string;
          dist_cobrado_centavos: number | null;
          dist_diezmo_bp: number | null;
          dist_diezmo_centavos: number | null;
          dist_fijos_centavos: number | null;
          dist_fijos_previo_centavos: number | null;
          dist_gastos_centavos: number | null;
          dist_liquidado_at: string | null;
          dist_objetivo_fijos_centavos: number | null;
          dist_objetivo_sueldo_centavos: number | null;
          dist_remanente_centavos: number | null;
          dist_sueldo_centavos: number | null;
          dist_sueldo_mensual: boolean | null;
          dist_sueldo_previo_centavos: number | null;
          dist_tope_fijos_centavos: number | null;
          dist_tope_sueldo_centavos: number | null;
          entrega_estimada: string | null;
          estado: Database['public']['Enums']['estado_proyecto'];
          fecha_cobro: string | null;
          fecha_entrega: string | null;
          fecha_inicio: string | null;
          fecha_visita: string | null;
          forma_pago: Database['public']['Enums']['forma_pago'] | null;
          household_id: string;
          id: string;
          notas: string;
          presupuesto_centavos: number | null;
          reapertura_fecha_cobro: string | null;
          reapertura_objetivo_fijos_centavos: number | null;
          reapertura_objetivo_sueldo_centavos: number | null;
          reapertura_sueldo_mensual: boolean | null;
          titulo: string;
          ultimo_contacto: string | null;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: '*';
          to: 'proyectos';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      comprobante: 'factura_a' | 'factura_b' | 'factura_c' | 'remito' | 'sin_comprobante';
      condicion_fiscal: 'consumidor_final' | 'monotributo' | 'responsable_inscripto' | 'exento';
      estado_proyecto:
        | 'contacto'
        | 'relevamiento'
        | 'a_presupuestar'
        | 'presupuesto_enviado'
        | 'perdido'
        | 'en_curso'
        | 'entregado'
        | 'cobrado';
      forma_pago: 'efectivo' | 'transferencia' | 'cuotas' | 'mixto';
      origen_contacto: 'referido' | 'redes' | 'volvio' | 'cartel' | 'otro';
      rol_household: 'titular' | 'miembro';
      tesoro: 'hogar' | 'maun' | 'diezmo' | 'cocos';
      tipo_movimiento:
        'ingreso' | 'gasto' | 'transferencia' | 'pago_diezmo' | 'aporte_cocos' | 'ajuste';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      comprobante: ['factura_a', 'factura_b', 'factura_c', 'remito', 'sin_comprobante'],
      condicion_fiscal: ['consumidor_final', 'monotributo', 'responsable_inscripto', 'exento'],
      estado_proyecto: [
        'contacto',
        'relevamiento',
        'a_presupuestar',
        'presupuesto_enviado',
        'perdido',
        'en_curso',
        'entregado',
        'cobrado',
      ],
      forma_pago: ['efectivo', 'transferencia', 'cuotas', 'mixto'],
      origen_contacto: ['referido', 'redes', 'volvio', 'cartel', 'otro'],
      rol_household: ['titular', 'miembro'],
      tesoro: ['hogar', 'maun', 'diezmo', 'cocos'],
      tipo_movimiento: [
        'ingreso',
        'gasto',
        'transferencia',
        'pago_diezmo',
        'aporte_cocos',
        'ajuste',
      ],
    },
  },
} as const;
