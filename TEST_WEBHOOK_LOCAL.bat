@echo off
title SIMULADOR DE WHATSAPP - NEXO IA
color 0a
echo ============================================================
echo   🤖 SIMULADOR DE MENSAJES (MODO DESARROLLO)
echo ============================================================
echo.
echo [!] Requiere WEBHOOK_ALLOW_UNSIGNED=true en Produccion\.env
echo     (el webhook valida firma HMAC por defecto). Ponlo en false
echo     al terminar de probar.
echo.
set /p msg="Escribe el mensaje para el Bot: "

curl -X POST http://localhost:3000/webhook/whatsapp ^
  -H "Content-Type: application/json" ^
  -d "{\"object\":\"whatsapp_business_account\",\"entry\":[{\"id\":\"0\",\"changes\":[{\"value\":{\"messaging_product\":\"whatsapp\",\"metadata\":{\"display_phone_number\":\"123456789\",\"phone_number_id\":\"0\"},\"messages\":[{\"from\":\"541122334455\",\"id\":\"wamid.HBgLNTQ5MTEzMDYyMzIxFQIAERgSQ0Y5REFEQ0M5RjQ5M0I4OUIzAA==\",\"timestamp\":\"1665522300\",\"text\":{\"body\":\"%msg%\"},\"type\":\"text\"}]},\"field\":\"messages\"}]}]}"

echo.
echo ============================================================
echo   ✅ Mensaje enviado al Webhook local. 
echo   Revisa la terminal del Backend y Supabase.
echo ============================================================
pause
