class AppFooter extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <footer class="bg-primary-200 border-t border-primary-300 py-8 mt-auto">
            <div class="max-w-5xl mx-auto px-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                    <div class="flex flex-col justify-center space-y-3">
                        <div class="space-y-1">
                            <h4 class="text-[10px] font-bold text-dark-900/40 uppercase tracking-tighter">Frontend</h4>
                            <div class="flex gap-1.5">
                                <span class="px-2 py-0.5 bg-white/50 text-[10px] font-bold rounded border border-primary-300 text-primary-600">#HTML</span>
                                <span class="px-2 py-0.5 bg-white/50 text-[10px] font-bold rounded border border-primary-300 text-primary-600">#JS</span>
                                <span class="px-2 py-0.5 bg-white/50 text-[10px] font-bold rounded border border-primary-300 text-primary-600">#TailwindCSS</span>
                            </div>
                        </div>
                        <div class="space-y-1">
                            <h4 class="text-[10px] font-bold text-dark-900/40 uppercase tracking-tighter">Backend & Database</h4>
                            <div class="flex flex-wrap gap-1.5">
                                <span class="px-2 py-0.5 bg-green-50 text-[10px] font-bold rounded border border-green-200 text-green-600">#NodeJS</span>
                                <span class="px-2 py-0.5 bg-green-50 text-[10px] font-bold rounded border border-green-200 text-green-600">#MongoDB</span>
                            </div>
                        </div>
                    </div>

                    <div class="md:border-x border-primary-300 px-8 text-center flex flex-col justify-center space-y-2">
                        <div class="flex justify-center items-center space-x-2">
                            <span class="text-lg font-black tracking-tighter text-dark-900">TaskGo</span>
                        </div>
                        <p class="text-xs font-bold text-dark-900 uppercase">Công nghệ Web và ứng dụng</p>
                        <p class="text-[11px] font-medium text-primary-600">SE347.Q14 - NHÓM 8</p>
                    </div>

                    <div class="flex flex-col justify-between md:items-end text-center md:text-right py-1">
                        <div class="space-y-1">
                            <h4 class="text-[10px] font-bold text-dark-900/40 uppercase tracking-tighter">Giảng viên hướng dẫn</h4>
                            <p class="text-sm font-bold text-dark-900">ThS. Trần Thị Hồng Yến</p>
                            <p class="text-[10px] text-gray-500 font-medium">Đại học Công nghệ Thông tin - ĐHQG TP.HCM</p>
                        </div>
                        <div class="mt-4 md:mt-0">
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">© 2025 NHÓM 8 • UIT</p>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
        `;
    }
}

customElements.define('app-footer', AppFooter);