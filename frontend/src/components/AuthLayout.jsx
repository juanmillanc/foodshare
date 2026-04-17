import { Link } from "react-router-dom";

export default function AuthLayout({ title, subtitle, children, footerText, footerLink, footerTo }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <header className="auth-header">
          <h1 className="logo">FoodShare</h1>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </header>
        <div>{children}</div>
        <footer className="auth-footer">
          {footerText} <Link to={footerTo}>{footerLink}</Link>
        </footer>
      </section>
    </main>
  );
}
