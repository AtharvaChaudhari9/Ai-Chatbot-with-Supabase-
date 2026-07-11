<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=true; section>
    <#if section = "header">
        <!-- Brand Header -->
        <div class="flex flex-col items-center text-center mb-8">
            <!-- Sparkles Logo -->
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg mb-4 ring-4 ring-indigo-950/50">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7 text-white"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/></svg>
            </div>
            <h1 class="text-3xl font-bold text-white">
                Welcome back
            </h1>
            <p class="text-xs text-neutral-450 mt-1">
                Sign in to access your previous conversations
            </p>
        </div>
    <#elseif section = "form">
        <!-- Google Social Login (if enabled in Keycloak Identity Providers) -->
        <#if social.providers??>
            <div class="space-y-3">
                <#list social.providers as p>
                    <#if p.alias = "google">
                        <a href="${p.loginUrl}" class="flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 py-3.5 text-sm font-medium text-neutral-200 hover:bg-neutral-900 transition-colors cursor-pointer text-decoration-none">
                            <!-- Colored Google logo SVG -->
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" class="h-5 w-5"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.1 29.3 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.3 35.1 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.4 39.6 16.1 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.4 5.7-6.5 7.2l6.2 5.2C38.7 37.2 44 31.1 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                            Continue with Google
                        </a>
                    </#if>
                </#list>
            </div>
            
            <div class="relative my-5">
                <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-neutral-900"></div></div>
                <div class="relative flex justify-center text-[10px]"><span class="bg-neutral-950 px-3 text-neutral-500 font-bold uppercase tracking-wider">OR</span></div>
            </div>
        </#if>

        <!-- Credentials Form -->
        <form action="${url.loginAction}" method="post" class="space-y-4">
            <div class="space-y-1.5">
                <label for="username" class="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                    Email Address
                </label>
                <div class="relative flex items-center">
                    <!-- Mail Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3.5 w-4.5 h-4.5 text-neutral-600"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    <input id="username" name="username" type="text" required placeholder="you@example.com" value="${(login.username!'')}" class="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 pl-11 pr-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-800 focus:outline-none transition-colors" />
                </div>
            </div>

            <div class="space-y-1.5">
                <div class="flex justify-between items-center">
                    <label for="password" class="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                        Password
                    </label>
                    <#if realm.resetPasswordAllowed>
                        <a href="${url.loginResetCredentialsUrl}" class="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300">Forgot?</a>
                    </#if>
                </div>
                <div class="relative flex items-center">
                    <!-- Lock Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3.5 w-4.5 h-4.5 text-neutral-600"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <input id="password" name="password" type="password" required placeholder="••••••••" class="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 pl-11 pr-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-800 focus:outline-none transition-colors" />
                </div>
            </div>

            <div class="flex items-center justify-between pt-1">
                <#if realm.rememberMe && !usernameEditDisabled??>
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input id="rememberMe" name="rememberMe" type="checkbox" <#if login.rememberMe??>checked</#if> class="rounded border-neutral-900 bg-neutral-900/40 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-neutral-950" />
                        <span class="text-[10px] text-neutral-450 uppercase tracking-wider font-bold">Remember me</span>
                    </label>
                </#if>
            </div>

            <button type="submit" class="flex w-full items-center justify-center gap-2 rounded-xl bg-white hover:bg-neutral-200 text-black py-3.5 text-sm font-semibold transition-all shadow-md mt-6 cursor-pointer hover:scale-[1.01]">
                Sign In
            </button>
        </form>

        <!-- Registration Link -->
        <#if realm.registrationAllowed && !registrationDisabled??>
            <div class="mt-6 text-center text-xs">
                <span class="text-neutral-500">Don't have an account? </span>
                <a href="${url.registrationUrl}" class="text-indigo-400 hover:text-indigo-300 font-semibold">Sign Up</a>
            </div>
        </#if>
    </#if>
</@layout.registrationLayout>
