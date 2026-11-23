<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title inertia>{{ config('app.name', 'FieldMA Central Monitor') }}</title>
        <script>
            (function () {
                try {
                    var stored = localStorage.getItem('fieldma-theme');
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (stored === 'dark' || (!stored && prefersDark)) {
                        document.documentElement.classList.add('dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                    }
                } catch (_) {}
            })();
        </script>
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body class="bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans antialiased selection:bg-zinc-200 selection:text-zinc-900 dark:selection:bg-zinc-700 dark:selection:text-zinc-100">
        @inertia
    </body>
</html>
