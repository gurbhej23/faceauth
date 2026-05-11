import { useState } from "react";
import axios from "axios";
import api from "../api/api";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage("");
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const getLoginErrorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const responseError = error.response?.data?.error;
      const responseDetail = error.response?.data?.detail;

      if (typeof responseError === "string") return responseError;
      if (typeof responseDetail === "string") return responseDetail;
      if (error.code === "ECONNABORTED") {
        return "Backend is not responding. Please check your Render service URL and status.";
      }
      if (!error.response) {
        return "Cannot reach the backend. Check VITE_API_BASE_URL on Vercel and CORS on Render.";
      }
    }

    return "Login failed. Please check your email and password.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await api.post("login/", formData);

      if (!response.data?.token || !response.data?.user?.email) {
        throw new Error("Login response did not include a token or user email.");
      }

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("pending_email", response.data.user.email);
      localStorage.setItem("email", response.data.user.email);

      navigate("/face-login");
    } catch (error) {
      console.log(error);
      setErrorMessage(getLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-5">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold text-white">
            AI
          </div>
        </div>

        <h1 className="text-4xl font-bold text-white text-center">
          AI Face Login
        </h1>

        <p className="text-gray-300 text-center mt-2 mb-8">
          Secure authentication with password and face verification
        </p>

        <div className="mb-5">
          <label className="text-white text-sm mb-2 block">Email Address</label>

          <input
            type="email"
            name="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-white transition"
          />
        </div>

        <div className="mb-6">
          <label className="text-white text-sm mb-2 block">Password</label>

          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            required
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-white transition"
          />
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-3 text-sm text-red-100">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:scale-105 transition duration-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
        >
          {isSubmitting ? "Signing in..." : "Continue to Face Verification"}
        </button>

        <div className="flex items-center my-6">
          <div className="flex-1 h-px bg-white/20"></div>

          <span className="px-3 text-gray-400 text-sm">
            AI Powered Security
          </span>

          <div className="flex-1 h-px bg-white/20"></div>
        </div>

        <p className="text-center text-gray-400 mt-6">
          Don't have an account?
          <span
            onClick={() => navigate("/register", { replace: true })}
            className="text-white ml-2 cursor-pointer hover:underline"
          >
            Create Account
          </span>
        </p>
      </form>
    </div>
  );
}

export default Login;
