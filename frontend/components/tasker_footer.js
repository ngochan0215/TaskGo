class TaskerFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
    <footer style="background-color: #A5B4FC;" class="border-t border-indigo-300 py-8 mt-auto text-[#111827] font-montserrat">
        <div class="max-w-5xl mx-auto px-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                <div class="flex flex-col justify-center space-y-3">
                    <div class="space-y-1">
                        <h4 class="text-[10px] font-bold text-indigo-900/60 uppercase tracking-tighter">Frontend</h4>
                        <div class="flex gap-1.5">
                            <span class="px-2 py-0.5 bg-white/50 text-[10px] font-bold rounded border border-indigo-200 text-[#3730A3]">#HTML</span>
                                                        <span class="px-2 py-0.5 bg-white/50 text-[10px] font-bold rounded border border-indigo-200 text-[#3730A3]">#JS</span>
                            <span class="px-2 py-0.5 bg-white/50 text-[10px] font-bold rounded border border-indigo-200 text-[#3730A3]">#TailwindCSS</span>
                        </div>
                    </div>
                    <div class="space-y-1">
                        <h4 class="text-[10px] font-bold text-indigo-900/60 uppercase tracking-tighter">Backend & Database</h4>
                        <div class="flex flex-wrap gap-1.5">
                            <span class="px-2 py-0.5 bg-white/50 text-[10px] font-bold rounded border border-indigo-200 text-[#3730A3]">#NodeJS</span>
                            <span class="px-2 py-0.5 bg-white/50 text-[10px] font-bold rounded border border-indigo-200 text-[#3730A3]">#MongoDB</span>
                        </div>
                    </div>
                </div>

                <div class="md:border-x border-indigo-300 px-8 text-center flex flex-col justify-center space-y-2">
                    <div class="flex justify-center items-center space-x-2">
                        <span class="text-xl font-black tracking-tighter text-[#111827]">TaskGo</span>
                    </div>
                    <p class="text-xs font-bold text-indigo-900 uppercase">Công nghệ Web và ứng dụng</p>
                    <p class="text-[11px] font-medium text-indigo-800">SE347.Q14 - NHÓM 8</p>
                </div>

                <div class="flex flex-col justify-between md:items-end text-center md:text-right py-1">
                    <div class="space-y-1">
                        <h4 class="text-[10px] font-bold text-indigo-900/60 uppercase tracking-tighter">Giảng viên hướng dẫn</h4>
                        <p class="text-sm font-bold text-[#111827]">ThS. Trần Thị Hồng Yến</p>
                        <p class="text-[10px] text-indigo-800 font-medium">Đại học Công nghệ Thông tin - ĐHQG TP.HCM</p>
                    </div>
                    <div class="mt-4 md:mt-0">
                        <p class="text-[10px] text-indigo-900/60 font-bold uppercase tracking-widest">© 2025 NHÓM 8 • UIT</p>
                    </div>
                </div>
            </div>
        </div>
    </footer>
    `;
  }
}

customElements.define("tasker-footer", TaskerFooter);