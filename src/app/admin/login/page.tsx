import LoginForm from "@/components/admin/LoginForm";

export const metadata = { title: "Iniciar sesión — Panel editorial" };

export default function AdminLoginPage() {
  return (
    <div className="container section" style={{ maxWidth: 420, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 4 }}>Panel editorial</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
        Inicia sesión para entrar a la Cola editorial y publicar contenido.
      </p>
      <LoginForm />
    </div>
  );
}
