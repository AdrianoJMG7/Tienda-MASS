import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { ProveedorSesion } from "./auth";
import { ProveedorCarrito } from "./carrito";
import { ProveedorFavoritos } from "./favoritos";
import "./styles.css";
import "./tienda.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <ProveedorCarrito>
          <ProveedorFavoritos>
            <App />
          </ProveedorFavoritos>
        </ProveedorCarrito>
      </ProveedorSesion>
    </BrowserRouter>
  </StrictMode>,
);
