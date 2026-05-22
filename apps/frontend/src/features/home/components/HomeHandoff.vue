<template>
  <section class="mt-10">
    <div
      class="grid items-center gap-8 rounded-3xl bg-[#003d92] p-10 text-white md:grid-cols-[1.4fr_1fr]"
    >
      <div>
        <div class="mb-3 text-xs font-bold tracking-[0.2em] text-white/70">
          ● 我們的角色
        </div>
        <h3
          class="leading-tight font-black tracking-[-0.02em] text-white"
          style="font-size: 2.25rem; margin: 0 0 16px"
        >
          看完數據，就<br />回去投履歷。
        </h3>
        <p
          class="max-w-120 text-[15px] leading-relaxed text-white/85"
          style="margin: 0"
        >
          CodeShore 不收履歷，也不接面試媒合。我們爬
          104、Cake 的公開職缺，讓你分析完後，<strong class="text-white"
            >再回原平台投履歷</strong
          >
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div
          v-for="ch in [
            { name: '104 人力銀行', share: '54%', host: 'https://104.com.tw' },
            { name: 'Cake', share: '28%', host: 'https://cake.me' },
          ]"
          :key="ch.name"
          class="flex items-center justify-between rounded-xl bg-white/10 p-4"
        >
          <div>
            <div class="text-sm font-bold">{{ ch.name }}</div>
            <div class="font-mono text-[11px] text-white/50">
              {{ ch.host }} · {{ ch.share }}
            </div>
          </div>
          <a
            :href="ch.host"
            target="_blank"
            class="flex h-7 w-7 items-center justify-center rounded-full bg-[#fd7700] text-base font-black text-[#001f2a]"
          >↗</a>
        </div>
      </div>
    </div>
  </section>
</template>
