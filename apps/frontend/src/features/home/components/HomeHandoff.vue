<template>
  <section class="mt-10">
    <div
      class="grid items-center gap-6 rounded-3xl bg-[#003d92] p-6 text-white md:gap-8 md:grid-cols-[1.4fr_1fr] md:p-10"
    >
      <div>
        <div class="mb-3 text-xs font-bold tracking-[0.2em] text-white/70">
          ● 我們做什麼
        </div>
        <h3
          class="leading-tight font-black tracking-[-0.02em] text-white"
          style="font-size: 2.25rem; margin: 0 0 16px"
        >
          數據看完，<br />下一步交給你。
        </h3>
        <p
          class="max-w-120 text-[15px] leading-relaxed text-white/85"
          style="margin: 0"
        >
          CodeShore 的定位很單純：幫你看懂市場。職缺資料來自 104、Cake，分析完了，<strong class="text-white">投履歷還是要回那裡。</strong>
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
