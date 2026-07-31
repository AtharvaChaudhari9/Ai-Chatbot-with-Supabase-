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
        
        <!-- Notifications & Success Popups mapping -->
        <#if displayMessage && message?has_content>
            <#assign isEmailSent = (message.summary?has_content && (message.summary?contains("email") || message.summary?contains("Email") || message.summary?contains("instructions") || message.summary?contains("sent")))>
            <#assign isPasswordSuccess = (!isEmailSent && message.type = 'success') || (message.summary?has_content && (message.summary?contains("password") || message.summary?contains("Password") || message.summary?contains("account updated")) && !isEmailSent)>

            <#if isPasswordSuccess>
                <!-- Cognexa-Themed Success Popup Modal (Only after password is changed) -->
                <div id="cognexa-success-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div class="relative w-full max-w-sm rounded-3xl border border-neutral-800 bg-neutral-950 p-7 text-center shadow-2xl">
                        <!-- Cross (X) Button -->
                        <button type="button" onclick="handleCloseModal()" class="absolute top-4 right-4 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-white transition-colors cursor-pointer">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>

                        <!-- Glowing Check Circle Icon -->
                        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 ring-4 ring-emerald-500/20 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                        </div>

                        <h3 class="text-lg font-bold text-white">Password Changed Successfully</h3>
                        <p class="text-xs text-neutral-300 mt-2 leading-relaxed">
                            Your password has been updated. Please sign in with your new credentials.
                        </p>

                        <!-- OK Button -->
                        <button type="button" onclick="handleCloseModal()" class="w-full rounded-xl bg-violet-600 hover:bg-violet-500 text-white py-3 text-xs font-semibold transition-all shadow-md mt-6 cursor-pointer">
                            OK
                        </button>
                    </div>
                </div>

                <script>
                    function handleCloseModal() {
                        var targetUrl = "${(url.loginUrl!url.loginAction)?js_string}";
                        if (window.history && window.history.replaceState) {
                            window.history.replaceState({}, document.title, window.location.pathname);
                        }
                        window.location.href = targetUrl;
                    }
                </script>
            <#else>
                <!-- Notification Banner (Green line for Email Sent / Red for errors) -->
                <div id="cognexa-msg-banner" class="mt-5 flex items-start justify-between gap-3 rounded-xl border <#if message.type = 'error'>border-red-950/40 bg-red-950/15 text-red-400<#else>border-emerald-950/40 bg-emerald-950/15 text-emerald-400</#if> p-3.5 text-xs">
                    <div class="flex items-start gap-2.5">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                        <span class="font-medium">
                            <#if isEmailSent>
                                An email containing your secure password reset link has been sent to your email address.
                            <#else>
                                ${message.summary}
                            </#if>
                        </span>
                    </div>
                    <button type="button" onclick="dismissBanner()" class="text-neutral-400 hover:text-white transition-colors shrink-0 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>

                <script>
                    function dismissBanner() {
                        var banner = document.getElementById('cognexa-msg-banner');
                        if (banner) banner.style.display = 'none';
                    }
                </script>
            </#if>
        </#if>
    </div>

    <!-- Footer Copyright -->
    <span class="absolute bottom-4 text-[10px] text-neutral-600 font-medium select-none">
        &copy; ${.now?string('yyyy')} Cognexa Inc. All rights reserved.
    </span>
</body>
</html>
</#macro>
