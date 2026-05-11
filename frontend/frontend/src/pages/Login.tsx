import { useState } from "react";
import api from "../api/api";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    try {
      const response = await api.post("login/", formData);

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("pending_email", response.data.user.email); // ← fix: .user.email
      localStorage.setItem("email", response.data.user.email); // ← add: for FaceRegister

      navigate("/face-login");
    } catch (error) {
      console.log(error);
      alert("Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
        {/* Logo */}

        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center text-4xl">
            🔐
          </div>
        </div>

        {/* Heading */}

        <h1 className="text-4xl font-bold text-white text-center">
          AI Face Login
        </h1>

        <p className="text-gray-300 text-center mt-2 mb-8">
          Secure authentication with password and face verification
        </p>

        {/* Email */}

        <div className="mb-5">
          <label className="text-white text-sm mb-2 block">Email Address</label>

          <input
            type="email"
            name="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-white transition"
          />
        </div>

        {/* Password */}

        <div className="mb-6">
          <label className="text-white text-sm mb-2 block">Password</label>

          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-white transition"
          />
        </div>

        {/* Login Button */}

        <button
          onClick={handleSubmit}
          className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:scale-105 transition duration-300"
        >
          Continue to Face Verification
        </button>

        {/* Divider */}

        <div className="flex items-center my-6">
          <div className="flex-1 h-px bg-white/20"></div>

          <span className="px-3 text-gray-400 text-sm">
            AI Powered Security
          </span>

          <div className="flex-1 h-px bg-white/20"></div>
        </div>

        {/* Register Link */}

        <p className="text-center text-gray-400 mt-6">
          Don't have an account?
          <span
            onClick={() => navigate("/register", { replace: true })}
            className="text-white ml-2 cursor-pointer hover:underline"
          >
            Create Account
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;
