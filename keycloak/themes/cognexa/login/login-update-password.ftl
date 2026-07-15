<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=true; section>
    <#if section = "header">
        <!-- Brand Header -->
        <div class="flex flex-col items-center text-center mb-8">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg mb-4 ring-4 ring-indigo-950/50 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7 text-white"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h1 class="text-3xl font-bold text-white">
                Update Password
            </h1>
            <p class="text-xs text-neutral-450 mt-1">
                Please configure a new secure password for your account
            </p>
        </div>
    <#elseif section = "form">
        <!-- Update Password Form -->
        <form action="${url.loginAction}" method="post" class="space-y-4">
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

            <button type="submit" class="flex w-full items-center justify-center gap-2 rounded-xl bg-white hover:bg-neutral-200 text-black py-3.5 text-sm font-semibold transition-all shadow-md mt-6 cursor-pointer hover:scale-[1.01]">
                Change Password
            </button>
        </form>
    </#if>
</@layout.registrationLayout>
