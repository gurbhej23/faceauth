import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL || "https://faceauth-ah1n.onrender.com/api/",
});

export default api;
