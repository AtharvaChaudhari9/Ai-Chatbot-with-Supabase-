<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=true; section>
    <#if section = "header">
        <!-- Brand Header -->
        <div class="flex flex-col items-center text-center mb-8">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg mb-4 ring-4 ring-indigo-950/50">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7 text-white"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h1 class="text-3xl font-bold text-white">
                Update Password
            </h1>
            <p class="text-xs text-neutral-400 mt-1">
                Please configure a new secure password for your account
            </p>
        </div>
    <#elseif section = "form">
        <!-- Update Password Form -->
        <form id="kc-passwd-update-form" action="${url.loginAction}" method="post" class="space-y-4" onsubmit="return handlePasswordSubmit(event)">
            <div id="pw-error-badge" class="hidden flex items-start gap-2.5 rounded-xl border border-red-950/40 bg-red-950/15 p-3.5 text-xs text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                <span id="pw-error-text">Passwords do not match.</span>
            </div>

            <div class="space-y-1.5">
                <label for="password-new" class="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                    New Password
                </label>
                <div class="relative flex items-center">
                    <!-- Lock Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3.5 w-4.5 h-4.5 text-neutral-600"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <input id="password-new" name="password-new" type="password" required placeholder="••••••••" class="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 pl-11 pr-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-800 focus:outline-none transition-colors" />
                </div>
            </div>

            <div class="space-y-1.5">
                <label for="password-confirm" class="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                    Confirm Password
                </label>
                <div class="relative flex items-center">
                    <!-- Lock Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3.5 w-4.5 h-4.5 text-neutral-600"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <input id="password-confirm" name="password-confirm" type="password" required placeholder="••••••••" class="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 pl-11 pr-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-800 focus:outline-none transition-colors" />
                </div>
            </div>

            <button id="btn-submit-pw" type="submit" class="flex w-full items-center justify-center gap-2 rounded-xl bg-white hover:bg-neutral-200 text-black py-3.5 text-sm font-semibold transition-all shadow-md mt-6 cursor-pointer hover:scale-[1.01]">
                Change Password
            </button>
        </form>

        <!-- Cognexa In-App Success Popup Modal -->
        <div id="password-success-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div class="relative w-full max-w-sm rounded-3xl border border-neutral-800 bg-neutral-950 p-7 text-center shadow-2xl">
                <!-- Cross (X) Button -->
                <button type="button" onclick="redirectToLogin()" class="absolute top-4 right-4 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-white transition-colors cursor-pointer">
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
                <button type="button" onclick="redirectToLogin()" class="w-full rounded-xl bg-violet-600 hover:bg-violet-500 text-white py-3 text-xs font-semibold transition-all shadow-md mt-6 cursor-pointer">
                    OK
                </button>
            </div>
        </div>

        <script>
            function redirectToLogin() {
                var loginUrl = "${(url.loginUrl!'/realms/chatbot-realm/protocol/openid-connect/auth?client_id=chatbot-frontend&response_type=code&scope=openid&redirect_uri=' + encodeURIComponent(window.location.origin + '/api/auth/callback/keycloak'))?js_string}";
                window.location.href = loginUrl;
            }

            function handlePasswordSubmit(e) {
                var p1 = document.getElementById('password-new').value;
                var p2 = document.getElementById('password-confirm').value;
                var errBadge = document.getElementById('pw-error-badge');
                var errText = document.getElementById('pw-error-text');

                if (p1 !== p2) {
                    e.preventDefault();
                    errText.innerText = 'Passwords do not match. Please verify and try again.';
                    errBadge.classList.remove('hidden');
                    return false;
                }

                if (p1.length < 6) {
                    e.preventDefault();
                    errText.innerText = 'Password must be at least 6 characters long.';
                    errBadge.classList.remove('hidden');
                    return false;
                }

                errBadge.classList.add('hidden');
                
                // Show modal after submission
                e.preventDefault();
                var form = document.getElementById('kc-passwd-update-form');
                var submitBtn = document.getElementById('btn-submit-pw');
                submitBtn.disabled = true;
                submitBtn.innerText = 'Updating...';

                var formData = new FormData(form);
                fetch(form.action, {
                    method: 'POST',
                    body: formData,
                    redirect: 'follow'
                }).then(function(res) {
                    document.getElementById('password-success-modal').classList.remove('hidden');
                }).catch(function(err) {
                    // Fallback to normal form submit if fetch blocked
                    form.submit();
                });

                return false;
            }
        </script>
    </#if>
</@layout.registrationLayout>
