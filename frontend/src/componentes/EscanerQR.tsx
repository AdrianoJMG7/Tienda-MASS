import { useEffect, useRef, useState } from "react";
import Campo from "./Campo";

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  alEscanear: (codigo: string) => void;
}

const TIMEOUT_SEGUNDOS = 30;

export default function EscanerQR({ abierto, alCerrar, alEscanear }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [codigoEscaneado, setCodigoEscaneado] = useState<string | null>(null);
  const [tieneCamara, setTieneCamara] = useState(true);
  const [tiempoRestante, setTiempoRestante] = useState(TIMEOUT_SEGUNDOS);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    if (!abierto) {
      setCodigoEscaneado(null);
      setError(null);
      setTiempoRestante(TIMEOUT_SEGUNDOS);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
        setVideoStream(null);
      }
      scanningRef.current = false;
      return;
    }

    // Iniciar timer de 30 segundos
    setTiempoRestante(TIMEOUT_SEGUNDOS);
    timeoutRef.current = setTimeout(() => {
      alCerrar();
    }, TIMEOUT_SEGUNDOS * 1000);

    const intervalo = setInterval(() => {
      setTiempoRestante((prev) => {
        if (prev <= 1) {
          clearInterval(intervalo);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Iniciar cámara
    iniciarCamara();

    return () => {
      clearInterval(intervalo);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
      }
      scanningRef.current = false;
    };
  }, [abierto, alCerrar]);

  async function iniciarCamara() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Cámara trasera
      });
      setVideoStream(stream);
      setTieneCamara(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanningRef.current = true;
        escanearFrame();
      }
    } catch (err: any) {
      console.error("Error al acceder a la cámara:", err);
      if (err?.name === "NotAllowedError") {
        setError("No se tiene permiso para acceder a la cámara. Por favor, habilita el acceso a la cámara en tu navegador.");
      } else if (err?.name === "NotFoundError") {
        setError("No se encontró ninguna cámara en este dispositivo.");
      } else if (err?.name === "NotSupportedError") {
        setError("Tu navegador no soporta el acceso a la cámara.");
      } else {
        setError("No se pudo acceder a la cámara: " + err.message);
      }
      setTieneCamara(false);
    }
  }

  function escanearFrame() {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current || codigoEscaneado) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Nota: Para escaneo real de QR, necesitaríamos una librería como jsQR
    // Por ahora, simulamos el escaneo después de 2 segundos
    setTimeout(() => {
      if (scanningRef.current && !codigoEscaneado) {
        // Simulación - en producción usar jsQR o similar
        // setCodigoEscaneado("SIMULADO-" + Date.now());
      }
    }, 2000);

    requestAnimationFrame(escanearFrame);
  }

  function confirmarEscaneo() {
    if (codigoEscaneado) {
      alEscanear(codigoEscaneado);
      setCodigoEscaneado(null);
      alCerrar();
    }
  }

  function cancelarEscaneo() {
    setCodigoEscaneado(null);
    // Reiniciar el timer
    setTiempoRestante(TIMEOUT_SEGUNDOS);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        alCerrar();
      }, TIMEOUT_SEGUNDOS * 1000);
    }
    scanningRef.current = true;
  }

  function manejarInputManual(evento: React.ChangeEvent<HTMLInputElement>) {
    setCodigoEscaneado(evento.target.value);
  }

  if (!abierto) return null;

  return (
    <div className={`panel-lateral ${abierto ? "panel-lateral-abierto" : ""}`}>
      <div className="escaner-qr">
        <div className="escaner-header">
          <h2>Escanear código QR</h2>
          <button type="button" className="cerrar" onClick={alCerrar} aria-label="Cerrar escáner">
            ✕
          </button>
        </div>

        {!tieneCamara ? (
          <div className="escaner-instrucciones">
            <p className="alerta">{error}</p>
            <h3>Instrucciones para habilitar la cámara:</h3>
            <ol>
              <li>Haz clic en el icono de candado o información en la barra de direcciones de tu navegador</li>
              <li>Busca la sección de "Permisos" o "Site Settings"</li>
              <li>Encuentra "Cámara" y selecciona "Permitir"</li>
              <li>Recarga la página y vuelve a intentar</li>
            </ol>
            <p className="nota">
              Si usas un dispositivo móvil, asegúrate de que la app tenga permiso para usar la cámara en la configuración del sistema.
            </p>
            <div className="escaner-botones">
              <Campo
                etiqueta="O ingresa el código manualmente"
                type="text"
                value={codigoEscaneado || ""}
                onChange={manejarInputManual}
                placeholder="Código QR o de barras"
              />
              {codigoEscaneado && (
                <button type="button" className="boton" onClick={confirmarEscaneo}>
                  Agregar a la venta
                </button>
              )}
            </div>
          </div>
        ) : codigoEscaneado ? (
          <div className="escaner-codigo">
            <p>Código escaneado:</p>
            <p className="codigo-escaneado">{codigoEscaneado}</p>
            <div className="escaner-botones">
              <button type="button" className="boton" onClick={confirmarEscaneo}>
                Agregar a la venta
              </button>
              <button type="button" className="boton secundario" onClick={cancelarEscaneo}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="escaner-vista">
              <video ref={videoRef} autoPlay playsInline muted />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <div className="escaner-overlay">
                <div className="escaner-marco">
                  <div className="esquina esquina-tl"></div>
                  <div className="esquina esquina-tr"></div>
                  <div className="esquina esquina-bl"></div>
                  <div className="esquina esquina-br"></div>
                </div>
              </div>
            </div>
            <p className="escaner-instrucciones">
              Apunta la cámara al código QR del producto. El escaneo es automático.
            </p>
            <div className="escaner-botones">
              <Campo
                etiqueta="O ingresa el código manualmente"
                type="text"
                value={codigoEscaneado || ""}
                onChange={manejarInputManual}
                placeholder="Código QR o de barras"
              />
            </div>
            <div className="timeout-indicador">
              Tiempo restante: {tiempoRestante}s
            </div>
          </>
        )}
      </div>
    </div>
  );
}
