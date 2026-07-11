<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true>
<!DOCTYPE html>
<html class="h-full bg-[#050505]">
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${msg("loginTitle",(realm.displayName!''))}</title>
    <link rel="icon" href="${url.resourcesPath}/img/favicon.ico" />
    
    <!-- Load Tailwind CSS via CDN for instant premium formatting -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        neutral: {
                            850: '#202020',
                        }
                    }
                }
            }
        }
    </script>
    
    <style>
        /* Custom input check styles to prevent ugly default states */
        input[type="checkbox"] {
            accent-color: #4f46e5;
        }
    </style>
</head>
<body class="relative flex min-h-screen flex-col items-center justify-center bg-[#050505] text-neutral-200 px-4 overflow-hidden">
    <!-- Glowing background spotlights -->
    <div class="absolute top-[-20%] left-[-20%] h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none"></div>
    <div class="absolute bottom-[-20%] right-[-20%] h-[600px] w-[600px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none"></div>

    <!-- Centered Card Container -->
    <div class="z-10 w-full max-w-md rounded-3xl border border-neutral-900 bg-neutral-950/60 p-8 shadow-2xl backdrop-blur-xl">
        
        <#nested "header">
        
        <#nested "form">
        
        <!-- Error & Status Notifications mapping -->
        <#if displayMessage && message?has_content>
            <div class="mt-5 flex items-start gap-3 rounded-xl border <#if message.type = 'error'>border-red-950/40 bg-red-950/15 text-red-400<#else>border-emerald-950/40 bg-emerald-950/15 text-emerald-400</#if> p-3.5 text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                <span class="font-medium">${message.summary}</span>
            </div>
        </#if>
    </div>

    <!-- Footer Copyright -->
    <span class="absolute bottom-4 text-[10px] text-neutral-600 font-medium select-none">
        &copy; ${.now?string('yyyy')} Cognexa Inc. All rights reserved.
    </span>
</body>
</html>
</#macro>
