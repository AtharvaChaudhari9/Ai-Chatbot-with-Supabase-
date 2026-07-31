<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=true displayMessage=true; section>
    <#if section = "header">
        <!-- Brand Header -->
        <div class="flex flex-col items-center text-center mb-8">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg mb-4 ring-4 ring-indigo-950/50">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7 text-white"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h1 class="text-3xl font-bold text-white">
                Forgot Password?
            </h1>
            <p class="text-xs text-neutral-400 mt-2 leading-relaxed">
                Enter your registered email address to receive password reset instructions.
            </p>
        </div>
    <#elseif section = "form">
        <form action="${url.loginAction}" method="post" class="space-y-5">
            <div class="space-y-1.5">
                <label for="username" class="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                    Email Address or Username
                </label>
                <div class="relative flex items-center">
                    <!-- Mail Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3.5 w-4.5 h-4.5 text-neutral-600"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    <input id="username" name="username" type="text" required placeholder="you@example.com" value="${(auth.attemptedUsername!'')}" autofocus class="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 pl-11 pr-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-violet-500 focus:outline-none transition-colors" />
                </div>
            </div>

            <div class="flex items-center justify-between gap-3 pt-2">
                <a href="${url.loginUrl}" class="flex-1 text-center rounded-xl border border-neutral-900 hover:bg-neutral-900 text-neutral-300 py-3 text-xs font-medium transition-colors text-decoration-none">
                    Back to Login
                </a>
                <button type="submit" class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-neutral-200 text-black py-3 text-xs font-semibold transition-all shadow-md cursor-pointer hover:scale-[1.01]">
                    Send Reset Link
                </button>
            </div>
        </form>
    </#if>
</@layout.registrationLayout>
