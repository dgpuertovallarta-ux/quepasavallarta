<?php
if (!defined('ABSPATH')) exit;
$activas = qpv_categorias_activas();
$pref = ['gobierno', 'comunidad', 'turismo', 'clima', 'servicios', 'jalisco', 'mexico'];
$secc = array_slice(array_values(array_filter($pref, fn($s) => in_array($s, $activas, true))), 0, 3);
if (!$secc) $secc = ['turismo', 'jalisco', 'mexico'];
$social = [
    ['Facebook', 'https://www.facebook.com/quepasavallarta', 'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z'],
    ['Instagram', 'https://www.instagram.com/quepasavallarta', 'M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.3.4.6.2 1 .5 1.5 1 .4.4.7.9 1 1.5.2.5.4 1.2.4 2.3.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.4 2.3-.2.6-.5 1-1 1.5-.4.4-.9.7-1.5 1-.5.2-1.2.4-2.3.4-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.3-.4-.6-.2-1-.5-1.5-1-.4-.4-.7-.9-1-1.5-.2-.5-.4-1.2-.4-2.3C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.4-2.3.2-.6.5-1 1-1.5.4-.4.9-.7 1.5-1 .5-.2 1.2-.4 2.3-.4C8.9 2 9.3 2 12 2Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Zm5.2-8.4a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z'],
];
$l = fn($h, $t) => '<a href="' . esc_url(home_url($h)) . '">' . qpv_e($t) . '</a>';
?>
</main>
<footer class="site-footer surface-dark">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-col">
        <img src="<?= esc_url(qpv_asset('brand/logo-transparent.png')) ?>" alt="Qué Pasa Vallarta" class="brand-logo">
        <p style="font-size:14px;color:var(--text-muted);max-width:300px;margin:0 0 14px">Información clara, útil y confiable para vivir y entender lo que pasa en Puerto Vallarta y el municipio.</p>
        <div class="footer-social">
          <?php foreach ($social as [$lab, $href, $path]): ?>
            <a href="<?= esc_url($href) ?>" aria-label="<?= esc_attr($lab) ?>" class="icon-link" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="<?= esc_attr($path) ?>"/></svg></a>
          <?php endforeach; ?>
        </div>
      </div>
      <div class="footer-col">
        <h4>Secciones</h4>
        <?= $l('/categoria/ultima-hora/', 'Última Hora') ?>
        <?php foreach ($secc as $s) echo $l("/categoria/$s/", qpv_categoria_nombre($s)); ?>
        <?= $l('/explica/', 'Explica') . $l('/agenda/', 'Vive Vallarta') . $l('/guia/', 'Guía') ?>
      </div>
      <div class="footer-col">
        <h4>Herramientas</h4>
        <?= $l('/proteccion-civil/', 'Protección Civil') . $l('/ahora/', 'Vallarta Ahora') . $l('/mi-vallarta/', 'Mi Zona') . $l('/alertas/', 'Alertas') . $l('/agenda/', 'Agenda') . $l('/pregunta/', 'Pregúntale a Vallarta') ?>
      </div>
      <div class="footer-col">
        <h4>Para negocios</h4>
        <?= $l('/conecta/', 'Anúnciate') . $l('/conecta/', 'Vallarta Conecta') . $l('/guia/', 'Guía de negocios') ?>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© <?= date('Y') ?> Qué Pasa Vallarta. Noticias verificadas por el equipo editorial.</span>
      <span>Hecho en Puerto Vallarta, para Puerto Vallarta. · <?= $l('/privacidad/', 'Aviso de privacidad') ?> · <a href="<?= esc_url(admin_url()) ?>">Panel editorial</a></span>
    </div>
  </div>
</footer>
<div class="toast" role="status" aria-live="polite" data-qpv-toast></div>
<?php wp_footer(); ?>
</body>
</html>
