import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("pending_email");

    navigate("/");
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-6">Dashboard</h1>

      <p className="text-gray-300 mb-10">
        Welcome! You are successfully logged in 🚀
      </p>

      {/* Logout Button */}

      <button
        onClick={handleLogout}
        className="bg-red-500 hover:bg-red-600 px-6 py-3 rounded-xl font-semibold transition"
      >
        Logout
      </button>
    </div>
  );
}

export default Dashboard;
  