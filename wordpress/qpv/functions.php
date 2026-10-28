<?php
/**
 * Qué Pasa Vallarta — tema de WordPress (2026-10-27).
 *
 * Reproduce el sitio original de Next.js: mismas clases CSS (assets/qpv.css
 * es una copia de src/app/globals.css), mismas secciones y mismas URLs:
 *   /noticia/{slug}   /categoria/{slug}   /explica/{slug}   /trafico   /reporte …
 *
 * Los datos de cada nota que no son nativos de WordPress viven en campos
 * personalizados (post meta) y se pueden escribir por la API REST, así el
 * "robot" (GitHub Actions) publica igual que antes.
 */

if (!defined('ABSPATH')) exit;

define('QPV_VER', '1.0.0');
define('QPV_TZ', 'America/Mexico_City');

require_once __DIR__ . '/inc/datos.php';
require_once __DIR__ . '/inc/estatico.php';
require_once __DIR__ . '/inc/componentes.php';
require_once __DIR__ . '/inc/rest.php';
require_once __DIR__ . '/inc/formularios.php';
require_once __DIR__ . '/inc/anuncios.php';

/* ---------- Configuración del tema ---------- */
add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', ['search-form', 'gallery', 'caption', 'style', 'script']);
});

/* URLs iguales al sitio anterior: /noticia/slug y /categoria/slug. */
add_action('after_switch_theme', function () {
    update_option('permalink_structure', '/noticia/%postname%/');
    update_option('category_base', 'categoria');
    update_option('timezone_string', QPV_TZ);
    update_option('date_format', 'j \d\e F \d\e Y');
    qpv_crear_categorias();
    qpv_crear_paginas();
    // Contenido de ejemplo de WordPress ("¡Hola, mundo!", página de ejemplo).
    foreach ([get_page_by_path('hola-mundo', OBJECT, 'post'), get_page_by_path('hello-world', OBJECT, 'post'), get_page_by_path('pagina-ejemplo'), get_page_by_path('sample-page')] as $p) {
        if ($p) wp_delete_post($p->ID, true);
    }
    qpv_crear_categorias(); // ya sin la nota de ejemplo, quita "Sin categoría"
    flush_rewrite_rules();
});

/* ---------- Estilos y scripts ---------- */
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style(
        'qpv-fuentes',
        'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700;800&family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,400&family=Sofia+Sans+Extra+Condensed:wght@600;700;800;900&display=swap',
        [],
        null
    );
    wp_enqueue_style('qpv', get_template_directory_uri() . '/assets/qpv.css', ['qpv-fuentes'], QPV_VER);
    wp_add_inline_style('qpv', ':root{--font-body:"Work Sans";--font-headline:"Noto Serif";--font-display-condensed:"Sofia Sans Extra Condensed"}');
    wp_enqueue_script('qpv', get_template_directory_uri() . '/assets/qpv.js', [], QPV_VER, true);
    // WordPress mete estilos de bloques que no usamos.
    wp_dequeue_style('wp-block-library');
    wp_dequeue_style('global-styles');
    wp_dequeue_style('classic-theme-styles');
}, 20);

/* Evita el parpadeo de tema: aplica el tema guardado antes de pintar. */
add_action('wp_head', function () {
    echo '<script>(function(){try{var t=localStorage.getItem("vc_theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})()</script>' . "\n";
}, 1);

/* Sin la barra de administración encima del diseño (sí en el panel). */
add_filter('show_admin_bar', '__return_false');

/* Quita cosas de WordPress que el sitio no usa. */
remove_action('wp_head', 'print_emoji_detection_script', 7);
remove_action('wp_print_styles', 'print_emoji_styles');
remove_action('wp_head', 'wp_generator');

/* Título de la pestaña igual al anterior. */
add_filter('document_title_separator', fn() => '—');
add_filter('document_title_parts', function ($p) {
    if (is_front_page()) return ['title' => 'Qué Pasa Vallarta', 'tagline' => 'Información clara y confiable de Puerto Vallarta.'];
    $p['site'] = 'Qué Pasa Vallarta';
    unset($p['tagline']);
    return $p;
});
