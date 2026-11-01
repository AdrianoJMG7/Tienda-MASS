import { useState, type FormEvent } from "react";
import { conFiltros, eliminar, patch, post } from "../../api";
import Campo from "../../componentes/Campo";
import Dialogo from "../../componentes/Dialogo";
import Paginacion from "../../componentes/Paginacion";
import Seleccion from "../../componentes/Seleccion";
import type { Paginado, Tienda, Vendedor } from "../../tipos";
import { useCarga, useEnvio, useRetraso } from "../../useCarga";

interface PropsFormulario {
  vendedor: Vendedor | null;
  tiendas: Tienda[];
  alGuardar: () => void;
}

function FormularioVendedor({ vendedor, tiendas, alGuardar }: PropsFormulario) {
  const [datos, setDatos] = useState({
    nombre: vendedor?.nombre ?? "",
    email: vendedor?.email ?? "",
    celular: vendedor?.celular ?? "",
    tienda: vendedor ? String(vendedor.tienda) : "",
    password: "",
  });
  const { errores, general, enviando, enviar } = useEnvio();
  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) =>
    setDatos({ ...datos, [campo]: e.target.value });
  // Se puede asignar a tiendas activas; la tienda actual se muestra aunque esté desactivada.
  const opciones = tiendas.filter((t) => t.activa || t.id === vendedor?.tienda);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const { password, ...resto } = datos;
    const cuerpo = { ...resto, tienda: Number(datos.tienda) || null, ...(password ? { password } : {}) };
    const ok = await enviar(() => (vendedor ? patch(`/vendedores/${vendedor.id}/`, cuerpo) : post("/vendedores/", cuerpo)));
    if (ok) alGuardar();
  }

  return (
    <form onSubmit={guardar} noValidate>
      {general && <p className="alerta" role="alert">{general}</p>}
      <Campo etiqueta="Nombre completo" value={datos.nombre} onChange={cambiar("nombre")} error={errores.nombre} required />
      <div className="rejilla-formulario">
        <Campo etiqueta="Email" type="email" value={datos.email} onChange={cambiar("email")} error={errores.email} required />
        <Campo
          etiqueta="Celular"
          type="tel"
          inputMode="numeric"
          placeholder="9XXXXXXXX"
          value={datos.celular}
          onChange={cambiar("celular")}
          error={errores.celular}
        />
      </div>
      <Seleccion etiqueta="Tienda" value={datos.tienda} onChange={cambiar("tienda")} error={errores.tienda} required>
        <option value="">Elige una tienda</option>
        {opciones.map((t) => (
          <option key={t.id} value={t.id}>
            {t.codigo} · {t.nombre}
            {t.activa ? "" : " (inactiva)"}
          </option>
        ))}
      </Seleccion>
      <Campo
        etiqueta={vendedor ? "Nueva contraseña (opcional)" : "Contraseña inicial"}
        type="password"
        autoComplete="new-password"
        value={datos.password}
        onChange={cambiar("password")}
        error={errores.password}
        ayuda="Mínimo 8 caracteres, que no sean solo números."
      />
      <button className="boton ancho" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar vendedor"}
      </button>
    </form>
  );
}

export default function Vendedores() {
  const [filtros, setFiltros] = useState({ tienda: "", q: "", page: 1 });
  const { datos: tiendas } = useCarga<Tienda[]>("/tiendas/");
  const q = useRetraso(filtros.q);
  const { datos, error, cargando, recargar } = useCarga<Paginado<Vendedor>>(
    conFiltros("/vendedores/", { ...filtros, q }),
  );
  const [editando, setEditando] = useState<Vendedor | null | undefined>(undefined);
  const [aviso, setAviso] = useState("");

  async function alternar(v: Vendedor) {
    try {
      if (v.is_active) {
        if (!confirm(`¿Desactivar a ${v.nombre}? No podrá iniciar sesión.`)) return;
        await eliminar(`/vendedores/${v.id}/`);
        setAviso(`${v.nombre} fue desactivado.`);
      } else {
        await patch(`/vendedores/${v.id}/`, { is_active: true });
        setAviso(`${v.nombre} fue reactivado.`);
      }
      recargar();
    } catch {
      setAviso(`No se pudo actualizar a ${v.nombre}.`);
    }
  }

  return (
    <section>
      <div className="barra-titulo">
        <div>
          <h1>Vendedores</h1>
          <p className="subtitulo">Cada vendedor trabaja en una tienda y solo ve la información de su local.</p>
        </div>
        <button type="button" className="boton" onClick={() => setEditando(null)}>
          Nuevo vendedor
        </button>
      </div>

      <div className="filtros">
        <Campo
          etiqueta="Buscar"
          type="search"
          placeholder="Nombre o email"
          value={filtros.q}
          onChange={(e) => setFiltros({ ...filtros, q: e.target.value, page: 1 })}
        />
        <Seleccion
          etiqueta="Tienda"
          value={filtros.tienda}
          onChange={(e) => setFiltros({ ...filtros, tienda: e.target.value, page: 1 })}
        >
          <option value="">Todas</option>
          {tiendas?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.codigo} · {t.nombre}
            </option>
          ))}
        </Seleccion>
      </div>

      <p className="aviso" role="status">{aviso}</p>
      {error && <p className="alerta" role="alert">{error}</p>}
      {cargando && !datos ? (
        <p className="estado">Cargando…</p>
      ) : datos?.results.length === 0 ? (
        <p className="estado">No hay vendedores con esos filtros.</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Vendedor</th>
              <th>Celular</th>
              <th>Tienda</th>
              <th>Estado</th>
              <th><span className="solo-lector">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {datos?.results.map((v) => (
              <tr key={v.id}>
                <td data-titulo="Vendedor">
                  <strong>{v.nombre}</strong>
                  <small className="dato-secundario">{v.email}</small>
                </td>
                <td data-titulo="Celular">{v.celular || "—"}</td>
                <td data-titulo="Tienda">
                  {v.tienda_codigo} · {v.tienda_nombre}
                </td>
                <td data-titulo="Estado">
                  <span className={`insignia ${v.is_active ? "activa" : "inactiva"}`}>
                    {v.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="acciones">
                  <button type="button" className="enlace" onClick={() => setEditando(v)}>Editar</button>
                  <button type="button" className="enlace" onClick={() => alternar(v)}>
                    {v.is_active ? "Desactivar" : "Reactivar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Paginacion pagina={filtros.page} total={datos?.count ?? 0} alCambiar={(page) => setFiltros({ ...filtros, page })} />

      <Dialogo
        titulo={editando ? `Editar a ${editando.nombre}` : "Nuevo vendedor"}
        abierto={editando !== undefined}
        alCerrar={() => setEditando(undefined)}
      >
        <FormularioVendedor
          vendedor={editando ?? null}
          tiendas={tiendas ?? []}
          alGuardar={() => {
            setAviso(editando ? "Vendedor actualizado." : "Vendedor creado. Ya puede iniciar sesión.");
            setEditando(undefined);
            recargar();
          }}
        />
      </Dialogo>
    </section>
  );
}
