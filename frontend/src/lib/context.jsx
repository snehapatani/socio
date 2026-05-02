import { createContext, useContext, useState, useEffect } from "react";

const Ctx = createContext(null);

export function BusinessProvider({ children }) {
  const [businessId, setBusinessId] = useState(
    () => localStorage.getItem("socio_business_id") || null
  );
  const [business, setBusiness] = useState(null);

  const save = (id) => {
    localStorage.setItem("socio_business_id", id);
    setBusinessId(id);
  };

  return (
    <Ctx.Provider value={{ businessId, setBusinessId: save, business, setBusiness }}>
      {children}
    </Ctx.Provider>
  );
}

export const useBusiness = () => useContext(Ctx);
