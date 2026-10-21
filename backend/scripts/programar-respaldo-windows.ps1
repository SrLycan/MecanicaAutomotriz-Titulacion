<#
  SS SWAP - Programa el respaldo diario en el Programador de tareas de Windows.

  Uso (PowerShell, desde la carpeta backend):
      powershell -ExecutionPolicy Bypass -File scripts\programar-respaldo-windows.ps1 -Hora 03:00
  Para quitarlo:
      Unregister-ScheduledTask -TaskName "SS SWAP - Respaldo diario" -Confirm:$false

  La tarea corre "npm run respaldo" con el usuario actual (lee backend\.env).
  Si el respaldo falla, el script termina con codigo 1 y queda marcado como
  error en el historial de la tarea y en Plataforma > Respaldos.
  Requiere que la PC este encendida a esa hora (si no, Windows lo corre al
  encender si se marca "Ejecutar lo antes posible", que este script activa).
#>
param(
    [string]$Hora = "03:00",
    [string]$Nombre = "SS SWAP - Respaldo diario"
)

$backend = Split-Path -Parent $PSScriptRoot
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$log = Join-Path $backend "..\respaldos\respaldo-programado.log"

$accion = New-ScheduledTaskAction -Execute "cmd.exe" `
    -Argument "/c `"`"$npm`" run respaldo -- --tipo automatico >> `"$log`" 2>&1`"" `
    -WorkingDirectory $backend
$disparador = New-ScheduledTaskTrigger -Daily -At $Hora
$opciones = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $Nombre -Action $accion -Trigger $disparador -Settings $opciones `
    -Description "Respaldo diario de la base de datos y uploads de SS SWAP (npm run respaldo)." -Force | Out-Null

Write-Host "Tarea '$Nombre' programada todos los dias a las $Hora. Registro: $log"
