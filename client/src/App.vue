<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:5000/api/vaults' });

// Navigation tabs: 'create' | 'access' | 'telemetry'
const activeTab = ref('create');

// Form state for creating drop
const payload = ref('');
const expiresInHours = ref(24);
const maxViews = ref(1);
const passcode = ref('');
const decoyPayload = ref('');
const maxFailedAttempts = ref(3);
const createdLink = ref(null);

// Form state for accessing drop
const secretKeyInput = ref('');
const accessPasscode = ref('');
const useDecoyMode = ref(false);
const retrievedData = ref(null);
const accessError = ref('');
const requiresPasscode = ref(false);
const viewsRemaining = ref(null);

// Telemetry logs
const telemetryLogs = ref([]);

const createVaultDrop = async () => {
    try {
        const res = await api.post('/create', {
            payload: payload.value,
            expiresInHours: Number(expiresInHours.value),
            maxViews: Number(maxViews.value),
            passcode: passcode.value || undefined,
            decoyPayload: decoyPayload.value || undefined,
            maxFailedAttempts: Number(maxFailedAttempts.value)
        });
        
        // Dynamically build the access link using window.location.origin so it honors port 3000
        const secretKey = res.data.accessUrl.split('/').pop();
        createdLink.value = `${window.location.origin}/#/vault/${secretKey}`;
        
        payload.value = '';
        passcode.value = '';
        decoyPayload.value = '';
    } catch (err) {
        alert(err.response?.data?.error || 'Failed to create payload');
    }
};

const accessVaultDrop = async (keyToOpen) => {
    const targetKey = keyToOpen || secretKeyInput.value;
    accessError.value = '';
    try {
        const res = await api.post(`/access/${targetKey}`, {
            passcode: accessPasscode.value || undefined,
            useDecoy: useDecoyMode.value
        });
        retrievedData.value = res.data.payload;
        viewsRemaining.value = res.data.viewsRemaining;
        requiresPasscode.value = false;
    } catch (err) {
        accessError.value = err.response?.data?.error || 'Access denied';
        if (err.response?.data?.requiresPasscode) {
            requiresPasscode.value = true;
        }
    }
};

const triggerPanicBurn = async (key) => {
    if (!confirm('WARNING: Annihilate this vault permanently right now?')) return;
    try {
        await api.post(`/burn/${key}`);
        alert('Vault incinerated successfully.');
        retrievedData.value = null;
    } catch (err) {
        alert('Failed to incinerate drop.');
    }
};

const fetchLogs = async () => {
    try {
        const res = await api.get('/logs/telemetry');
        telemetryLogs.value = res.data.logs;
    } catch (err) {
        console.error('Failed to load logs');
    }
};

onMounted(() => {
    // Check if URL has secret key pattern e.g. /#key
    const hash = window.location.hash;
    if (hash.startsWith('#/vault/')) {
        secretKeyInput.value = hash.replace('#/vault/', '');
        activeTab.value = 'access';
        accessVaultDrop(secretKeyInput.value);
    }
});
</script>

<template>
  <div class="min-h-screen p-6 max-w-4xl mx-auto flex flex-col justify-between">
    <!-- Header -->
    <header class="border-b border-cyberneon/30 pb-4 mb-8 flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-black tracking-widest text-cyberneon">SHADOW<span class="text-cyberred">VAULT</span></h1>
        <p class="text-xs text-gray-400 tracking-wider">ZERO-TRUST EPHEMERAL ASSET DELIVERY SYSTEM</p>
      </div>
      <nav class="flex gap-2">
        <button @click="activeTab = 'create'" :class="activeTab === 'create' ? 'bg-cyberneon text-cyberdark' : 'bg-cybercard text-gray-300'" class="px-4 py-2 text-sm font-bold border border-cyberneon/40 transition">Deploy Drop</button>
        <button @click="activeTab = 'access'" :class="activeTab === 'access' ? 'bg-cyberneon text-cyberdark' : 'bg-cybercard text-gray-300'" class="px-4 py-2 text-sm font-bold border border-cyberneon/40 transition">Retrieve Payload</button>
        <button @click="activeTab = 'telemetry'; fetchLogs()" :class="activeTab === 'telemetry' ? 'bg-cyberneon text-cyberdark' : 'bg-cybercard text-gray-300'" class="px-4 py-2 text-sm font-bold border border-cyberneon/40 transition">Audit Logs</button>
      </nav>
    </header>

    <!-- Main Content Area -->
    <main class="flex-grow">
      <!-- CREATE TAB -->
      <section v-if="activeTab === 'create'" class="bg-cybercard border border-cyberneon/20 p-6 rounded-lg shadow-2xl">
        <h2 class="text-xl font-bold mb-4 text-cyberneon">>> Initialize New Secure Drop</h2>
        <form @submit.prevent="createVaultDrop" class="space-y-4">
          <div>
            <label class="block text-xs uppercase tracking-wider mb-1 text-gray-400">Secret Payload (Message or Text)</label>
            <textarea v-model="payload" required rows="4" class="w-full bg-cyberdark border border-gray-700 p-3 rounded text-cyberneon focus:border-cyberneon outline-none" placeholder="Enter sensitive information here..."></textarea>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase tracking-wider mb-1 text-gray-400">Expiry Time (Hours)</label>
              <input type="number" v-model="expiresInHours" class="w-full bg-cyberdark border border-gray-700 p-2 rounded text-cyberneon outline-none">
            </div>
            <div>
              <label class="block text-xs uppercase tracking-wider mb-1 text-gray-400">Max Views Allowed</label>
              <input type="number" v-model="maxViews" class="w-full bg-cyberdark border border-gray-700 p-2 rounded text-cyberneon outline-none">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase tracking-wider mb-1 text-gray-400">Optional Passcode Protection</label>
              <input type="password" v-model="passcode" class="w-full bg-cyberdark border border-gray-700 p-2 rounded text-cyberneon outline-none" placeholder="Optional unlock key">
            </div>
            <div>
              <label class="block text-xs uppercase tracking-wider mb-1 text-gray-400">Max Failed Attempts Before Burn</label>
              <input type="number" v-model="maxFailedAttempts" class="w-full bg-cyberdark border border-gray-700 p-2 rounded text-cyberneon outline-none">
            </div>
          </div>

          <div>
            <label class="block text-xs uppercase tracking-wider mb-1 text-gray-400">Duress Decoy Payload (Optional)</label>
            <input type="text" v-model="decoyPayload" class="w-full bg-cyberdark border border-gray-700 p-2 rounded text-gray-300 outline-none" placeholder="Revealed if forced under pressure or wrong pin sequence">
          </div>

          <button type="submit" class="w-full bg-cyberneon text-cyberdark font-black py-3 rounded tracking-wider hover:bg-cyberneon/80 transition">ENCRYPT & DEPLOY</button>
        </form>

        <div v-if="createdLink" class="mt-6 p-4 bg-cyberdark border border-cyberneon rounded">
          <p class="text-xs text-cyberneon mb-1 font-bold">DEPLOYMENT SUCCESSFUL. SECURE ACCESS LINK:</p>
          <input type="text" readonly :value="createdLink" class="w-full bg-cybercard p-2 text-sm text-gray-300 border border-gray-800 rounded select-all">
        </div>
      </section>

      <!-- ACCESS TAB -->
      <section v-if="activeTab === 'access'" class="bg-cybercard border border-cyberneon/20 p-6 rounded-lg shadow-2xl">
        <h2 class="text-xl font-bold mb-4 text-cyberneon">>> Retrieve Secure Drop</h2>
        
        <div v-if="!retrievedData" class="space-y-4">
          <div>
            <label class="block text-xs uppercase tracking-wider mb-1 text-gray-400">Vault Secret Key</label>
            <input type="text" v-model="secretKeyInput" class="w-full bg-cyberdark border border-gray-700 p-3 rounded text-cyberneon outline-none" placeholder="Paste secret key or hash string...">
          </div>

          <div v-if="requiresPasscode">
            <label class="block text-xs uppercase tracking-wider mb-1 text-cyberred">Passcode Required</label>
            <input type="password" v-model="accessPasscode" class="w-full bg-cyberdark border border-cyberred p-3 rounded text-cyberred outline-none" placeholder="Enter secure access key...">
          </div>

          <div class="flex items-center gap-2 pt-2">
            <input type="checkbox" id="decoy" v-model="useDecoyMode" class="accent-cyberneon">
            <label for="decoy" class="text-xs text-gray-400 cursor-pointer">Engage Duress / Decoy Mode (Deploy Secondary Payload)</label>
          </div>

          <button @click="accessVaultDrop(null)" class="w-full bg-cyberred text-white font-black py-3 rounded tracking-wider hover:bg-cyberred/80 transition">ACCESS VAULT PAYLOAD</button>
          
          <p v-if="accessError" class="text-cyberred text-sm mt-2 font-bold">{{ accessError }}</p>
        </div>

        <div v-else class="space-y-4">
          <div class="p-4 bg-cyberdark border border-cyberneon rounded">
            <p class="text-xs text-gray-400 mb-2">DECRYPTED PAYLOAD CONTENT:</p>
            <div class="p-3 bg-cybercard border border-gray-800 rounded text-cyberneon whitespace-pre-wrap font-mono">{{ retrievedData }}</div>
          </div>
          <div class="flex justify-between items-center text-xs text-gray-400">
            <span>Views Remaining Before Auto-Burn: <strong class="text-cyberneon">{{ viewsRemaining }}</strong></span>
            <button @click="triggerPanicBurn(secretKeyInput)" class="bg-cyberred text-white px-3 py-1 font-bold rounded">PANIC ANNIHILATE NOW</button>
          </div>
        </div>
      </section>

      <!-- AUDIT LOGS TAB -->
      <section v-if="activeTab === 'telemetry'" class="bg-cybercard border border-cyberneon/20 p-6 rounded-lg shadow-2xl">
        <h2 class="text-xl font-bold mb-4 text-cyberneon">>> Telemetry & Audit Logs</h2>
        <div class="overflow-x-auto max-h-96">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-gray-800 text-gray-400">
                <th class="p-2">Timestamp</th>
                <th class="p-2">Action</th>
                <th class="p-2">IP Address</th>
                <th class="p-2">Details</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in telemetryLogs" :key="log.id" class="border-b border-gray-900 hover:bg-cyberdark/50">
                <td class="p-2 text-gray-400">{{ new Date(log.created_at).toLocaleString() }}</td>
                <td class="p-2" :class="log.action === 'VIEW_SUCCESS' ? 'text-cyberneon' : 'text-cyberred'">{{ log.action }}</td>
                <td class="p-2 text-gray-300">{{ log.ip_address }}</td>
                <td class="p-2 text-gray-300">{{ log.details }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="mt-8 border-t border-gray-800 pt-4 text-center text-xs text-gray-500">
      ShadowVault Secure Protocol // Stack: Vue 3 + Express.js + PostgreSQL
    </footer>
  </div>
</template>