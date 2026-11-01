import { useCallback, useEffect, useState } from "react";
import { api, ErrorApi } from "./api";

/** Carga datos de la API cada vez que cambia la ruta; `recargar` vuelve a pedirlos. */
export function useCarga<T>(ruta: string | null) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!ruta) return;
    let vigente = true;
    setCargando(true);
    api<T>(ruta)
      .then((respuesta) => {
        if (!vigente) return;
        setDatos(respuesta);
        setError("");
      })
      .catch((e) => vigente && setError(e instanceof ErrorApi ? e.message : "No se pudo cargar la información."))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [ruta, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { datos, error, cargando, recargar };
}

/** Devuelve el valor solo cuando deja de cambiar (p. ej. al terminar de escribir una búsqueda). */
export function useRetraso<T>(valor: T, ms = 300) {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(temporizador);
  }, [valor, ms]);
  return retrasado;
}

/** Manejo común de envío de formularios: errores por campo y mensaje general. */
export function useEnvio() {
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = useCallback(async (accion: () => Promise<unknown>) => {
    setErrores({});
    setGeneral("");
    setEnviando(true);
    try {
      await accion();
      return true;
    } catch (e) {
      if (e instanceof ErrorApi) {
        setErrores(e.campos);
        setGeneral(e.message);
      } else {
        setGeneral("No se pudo guardar.");
      }
      return false;
    } finally {
      setEnviando(false);
    }
  }, []);

  return { errores, general, enviando, enviar };
}
