@echo off
title NEXO IA v15 - Sistema de Control
color 0b

echo ==========================================
echo    INICIANDO NEXO IA v15 ENTERPRISE
echo ==========================================
echo.

:: 1. Iniciar el Backend (Servidor y IA)
echo [+] Lanzando Servidor Backend...
start "Nexo v15 - BACKEND" cmd /k "cd /d %~dp0 && npm run dev"

:: 2. Iniciar el Dashboard (Interfaz Visual)
echo [+] Lanzando Dashboard Visual...
start "Nexo v15 - DASHBOARD" cmd /k "cd /d %~dp0dashboard && npm run dev"

echo.
echo ==========================================
echo    SISTEMA LISTO
echo ==========================================
echo.
echo 🔗 Dashboard: http://localhost:5173
echo 🔑 Credenciales: definidas en .env (ADMIN_EMAIL / ADMIN_PASSWORD)
echo.
echo [!] No cierres las ventanas negras mientras uses el sistema.
pause
