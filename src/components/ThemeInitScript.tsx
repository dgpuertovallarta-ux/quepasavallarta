// Evita el flash de tema: aplica el tema guardado antes del primer pintado.
// Ver /docs/NEXTJS_MIGRATION.md y la guía "preventing flash before hydration" de Next.js 16.
export default function ThemeInitScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var t=localStorage.getItem("vc_theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
      }}
    />
  );
}
