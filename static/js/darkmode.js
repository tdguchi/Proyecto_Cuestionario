// Archivo vacío - toda la funcionalidad del modo oscuro ha sido eliminada 

document.addEventListener('DOMContentLoaded', function() {
    const themeSwitch = document.getElementById('themeSwitch');
    const htmlElement = document.documentElement;
    
    // Aplicar tema oscuro
    function applyDarkTheme() {
        htmlElement.setAttribute('data-bs-theme', 'dark');
        document.body.style.backgroundColor = '#121212';
        document.body.classList.add('dark-mode');
        themeSwitch.checked = true;
        console.log('Modo oscuro activado');
    }
    
    // Aplicar tema claro
    function applyLightTheme() {
        htmlElement.setAttribute('data-bs-theme', 'light');
        document.body.style.backgroundColor = '';
        document.body.classList.remove('dark-mode');
        themeSwitch.checked = false;
        console.log('Modo claro activado');
    }
    
    // Verificar preferencia guardada o del sistema
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        applyDarkTheme();
    } else {
        applyLightTheme();
    }
    
    // Cambiar tema al activar/desactivar el interruptor
    themeSwitch.addEventListener('change', function() {
        if (this.checked) {
            applyDarkTheme();
            localStorage.setItem('theme', 'dark');
        } else {
            applyLightTheme();
            localStorage.setItem('theme', 'light');
        }
    });
    
    // Forzar la aplicación inmediata de estilos
    setTimeout(function() {
        if (htmlElement.getAttribute('data-bs-theme') === 'dark') {
            document.body.style.backgroundColor = '#121212';
        }
    }, 50);
}); 