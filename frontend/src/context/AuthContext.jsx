import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("neuro_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("neuro_token");
    if (!token) { setLoading(false); return; }
    api.get("/auth/me")
      .then((r) => {
        setUser(r.data);
        localStorage.setItem("neuro_user", JSON.stringify(r.data));
      })
      .catch(() => {
        localStorage.removeItem("neuro_token");
        localStorage.removeItem("neuro_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("neuro_token", data.token);
    localStorage.setItem("neuro_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const register = async (full_name, email, password) => {
    const { data } = await api.post("/auth/register", { full_name, email, password });
    localStorage.setItem("neuro_token", data.token);
    localStorage.setItem("neuro_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("neuro_token");
    localStorage.removeItem("neuro_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
