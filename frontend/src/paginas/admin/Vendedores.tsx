import { useState, type FormEvent } from "react";
import { conFiltros, eliminar, patch, post } from "../../api";
import Campo from "../../componentes/Campo";
import Dialogo from "../../componentes/Dialogo";
import DialogoConfirmar from "../../componentes/DialogoConfirmar";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import Icono from "../../componentes/Icono";
import Paginacion from "../../componentes/Paginacion";
import Seleccion from "../../componentes/Seleccion";
import type { Paginado, Tienda, Vendedor } from "../../tipos";
import { useCarga, useEnvio, useRetraso } from "../../useCarga";

const POR_PAGINA = 10;

interface PropsFormulario {
  vendedor: Vendedor | null;
  tiendas: Tienda[];
  alGuardar: (guardado: Vendedor) => void;
  alCancelar: () => void;
}

function FormularioVendedor({ vendedor, tiendas, alGuardar, alCancelar }: PropsFormulario) {
  const [datos, setDatos] = useState({
    nombre: vendedor?.nombre ?? "",
    email: vendedor?.email ?? "",
    celular: vendedor?.celular ?? "",
    tienda: vendedor ? String(vendedor.tienda) : "",
    password: "",
  });
  const { errores, general, enviando, enviar } = useEnvio();
  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) => setDatos({ ...datos, [campo]: e.target.value });
  // Se puede asignar a tiendas activas; la tienda actual se muestra aunque esté desactivada.
  const opciones = tiendas.filter((t) => t.activa || t.id === vendedor?.tienda);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const { password, ...resto } = datos;
    const cuerpo = { ...resto, tienda: Number(datos.tienda) || null, ...(password ? { password } : {}) };
    await enviar(async () => {
      alGuardar(await (vendedor ? patch<Vendedor>(`/auth/usuarios/${vendedor.id}/`, cuerpo) : post<Vendedor>("/auth/usuarios/", cuerpo)));
    });
  }

  return (
    <form onSubmit={guardar} noValidate>
      {general && !Object.keys(errores).length && <p className="alerta" role="alert">{general}</p>}
      <Campo etiqueta="Nombre completo *" placeholder="Ej.: María López" value={datos.nombre} onChange={cambiar("nombre")} error={errores.nombre} required />
      <Campo etiqueta="Email *" type="email" placeholder="ejemplo@mass.pe" value={datos.email} onChange={cambiar("email")} error={errores.email} required />
      <Campo etiqueta="Celular *" type="tel" inputMode="numeric" placeholder="9XXXXXXXX" value={datos.celular} onChange={cambiar("celular")} error={errores.celular} required />
      <Seleccion etiqueta="Tienda *" value={datos.tienda} onChange={cambiar("tienda")} error={errores.tienda} required>
        <option value="">Elige una tienda</option>
        {opciones.map((t) => (
          <option key={t.id} value={t.id}>
            {t.codigo} · {t.nombre}
            {t.activa ? "" : " (inactiva)"}
          </option>
        ))}
      </Seleccion>
      <Campo
        etiqueta={vendedor ? "Nueva contraseña (opcional)" : "Contraseña inicial (opcional)"}
        type="password"
        autoComplete="new-password"
        value={datos.password}
        onChange={cambiar("password")}
        error={errores.password}
        ayuda={vendedor ? "Déjala vacía para no cambiarla." : "Mínimo 8 caracteres, que no sean solo números. Si la dejas vacía, generamos una."}
      />
      <div className="acciones-dialogo">
        <button type="button" className="boton-contorno" onClick={alCancelar}>Cancelar</button>
        <button className="boton-primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar vendedor"}</button>
      </div>
    </form>
  );
}

/** HU04: registrar vendedores, asignarlos a una tienda y desactivarlos. */
export default function Vendedores() {
  const [filtros, setFiltros] = useState({ tienda: "", q: "", page: 1 });
  const { datos: tiendas } = useCarga<Tienda[]>("/tiendas/tiendas/");
  const q = useRetraso(filtros.q);
  const { datos, error, cargando, recargar } = useCarga<Paginado<Vendedor>>(conFiltros("/auth/usuarios/", { ...filtros, q, page_size: POR_PAGINA }));
  const [editando, setEditando] = useState<Vendedor | null | undefined>(undefined);
  const [desactivando, setDesactivando] = useState<Vendedor | null>(null);
  const [nuevo, setNuevo] = useState<Vendedor | null>(null);
  const [aviso, setAviso] = useState("");
  const [errorAccion, setErrorAccion] = useState("");

  async function reactivar(v: Vendedor) {
    setErrorAccion("");
    try {
      await patch(`/auth/usuarios/${v.id}/`, { is_active: true });
      setAviso(`${v.nombre} fue reactivado.`);
      recargar();
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : `No se pudo reactivar a ${v.nombre}.`);
    }
  }

  return (
    <section>
      <EncabezadoPagina icono="usuarios" titulo="Vendedores" subtitulo="Cada vendedor trabaja en una tienda y solo ve la información de su local." />

      <div className="filtros-admin">
        <div className="buscador">
          <Icono nombre="buscar" />
          <label htmlFor="buscar-vendedor" className="solo-lector">Buscar por nombre o email</label>
          <input id="buscar-vendedor" type="search" placeholder="Nombre o email" value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value, page: 1 })} />
        </div>
        <span className="filtro-icono">
          <Icono nombre="tienda" />
          <label htmlFor="filtro-tienda" className="solo-lector">Filtrar por tienda</label>
          <select id="filtro-tienda" value={filtros.tienda} onChange={(e) => setFiltros({ ...filtros, tienda: e.target.value, page: 1 })}>
            <option value="">Todas las tiendas</option>
            {tiendas?.map((t) => (
              <option key={t.id} value={t.id}>{t.codigo} · {t.nombre}</option>
            ))}
          </select>
        </span>
        <button type="button" className="boton-primario accion-derecha" onClick={() => setEditando(null)}>
          <Icono nombre="mas" /> Nuevo vendedor
        </button>
      </div>

      {aviso && <p className="aviso" role="status">{aviso}</p>}
      {(error || errorAccion) && <p className="alerta" role="alert">{errorAccion || error}</p>}
      {cargando && !datos ? (
        <p className="estado">Cargando vendedores…</p>
      ) : (
        <div className="tarjeta contenedor-tabla">
          <table className="tabla tabla-vendedor" aria-busy={cargando}>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Celular</th>
                <th>Tienda</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {datos?.results.map((v) => (
                <tr key={v.id}>
                  <td data-titulo="Vendedor">
                    <span className="producto-celda">
                      <span className="avatar pequeno" aria-hidden="true"><Icono nombre="usuario" /></span>
                      <span>
                        <strong>{v.nombre}</strong>
                        <small className="dato-secundario">{v.email}</small>
                      </span>
                    </span>
                  </td>
                  <td data-titulo="Celular">{v.celular || "—"}</td>
                  <td data-titulo="Tienda">{v.tienda_codigo} · {v.tienda_nombre}</td>
                  <td data-titulo="Estado">
                    <span className={`estado-stock ${v.is_active ? "disponible" : "inactivo"}`}>
                      <i aria-hidden="true" /> {v.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td data-titulo="Acciones">
                    <div className="acciones-fila">
                      <button type="button" className="boton-contorno pequeno" onClick={() => setEditando(v)}>
                        <Icono nombre="lapiz" tamano={18} /> Editar<span className="solo-lector"> a {v.nombre}</span>
                      </button>
                      {v.is_active ? (
                        <button type="button" className="boton-contorno pequeno" onClick={() => setDesactivando(v)}>
                          <Icono nombre="apagar" tamano={18} /> Desactivar<span className="solo-lector"> a {v.nombre}</span>
                        </button>
                      ) : (
                        <button type="button" className="boton-contorno pequeno" onClick={() => void reactivar(v)}>
                          <Icono nombre="iniciar" tamano={18} /> Activar<span className="solo-lector"> a {v.nombre}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {datos?.results.length === 0 && <p className="estado">No hay vendedores con esos filtros.</p>}
          <div className="pie-tabla">
            <span>
              {datos && datos.count > 0 &&
                `Mostrando ${(filtros.page - 1) * POR_PAGINA + 1} – ${Math.min(filtros.page * POR_PAGINA, datos.count)} de ${datos.count} vendedores`}
            </span>
            <Paginacion pagina={filtros.page} total={datos?.count ?? 0} porPagina={POR_PAGINA} alCambiar={(page) => setFiltros({ ...filtros, page })} />
          </div>
        </div>
      )}

      <Dialogo titulo={editando ? `Editar a ${editando.nombre}` : "Nuevo vendedor"} abierto={editando !== undefined} alCerrar={() => setEditando(undefined)}>
        <FormularioVendedor
          vendedor={editando ?? null}
          tiendas={tiendas ?? []}
          alCancelar={() => setEditando(undefined)}
          alGuardar={(guardado) => {
            setAviso(editando ? "Vendedor actualizado." : `${guardado.nombre} ya puede iniciar sesión.`);
            if (guardado.password_temporal) setNuevo(guardado);
            setEditando(undefined);
            recargar();
          }}
        />
      </Dialogo>

      <Dialogo titulo="Contraseña temporal" abierto={nuevo !== null} alCerrar={() => setNuevo(null)}>
        <p>
          Entrégale esta contraseña a <strong>{nuevo?.nombre}</strong>. No se volverá a mostrar; podrá cambiarla desde Mi perfil.
        </p>
        <p className="stock-actual contrasena-temporal">{nuevo?.password_temporal}</p>
        <div className="acciones-dialogo">
          <button type="button" className="boton-primario" onClick={() => setNuevo(null)}>
            <Icono nombre="check" /> Listo
          </button>
        </div>
      </Dialogo>

      <DialogoConfirmar
        titulo="Desactivar vendedor"
        abierto={desactivando !== null}
        textoConfirmar="Sí, desactivar"
        alCerrar={() => setDesactivando(null)}
        alConfirmar={async () => {
          await eliminar(`/auth/usuarios/${desactivando!.id}/`);
          setAviso(`${desactivando!.nombre} fue desactivado.`);
          recargar();
        }}
      >
        <p>{desactivando?.nombre} no podrá iniciar sesión. Sus ventas se conservan.</p>
      </DialogoConfirmar>
    </section>
  );
}
