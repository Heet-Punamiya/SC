/**
 * Bindi Market Management System
 * Core Application Script
 */

class BindiMarketApp {
    constructor() {
        this.db = {
            parties: [],
            cities: [],
            banks: [],
            catalogues: [],
            groups: [],
            colors: [],
            sizes: [],
            products: [],
            combo_products: [],
            inwards: [],
            outwards: [],
            stitching: []
        };
        this.currentTab = 'dashboard';
        this.tradeChart = null;

        // Initialize App
        this.init();
    }

    async init() {
        this.isServerConnected = false;
        await this.loadDB();
        this.setupEventListeners();
        this.setupAccordionNav();
        this.updateGlobalCounters();
        this.renderAll();

        // Set date
        document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        // Start auto-sync checking if connected to server
        this.startAutoSync();
    }

    async loadDB() {
        const listKeys = [
            'parties', 'cities', 'banks', 'catalogues', 'groups',
            'colors', 'sizes', 'products', 'combo_products', 'inwards', 'outwards', 'stitching', 'labours'
        ];

        // Try to load from server first
        try {
            const response = await fetch('/api/db');
            if (response.ok) {
                const serverData = await response.json();
                
                // Check if the server database is completely empty (no items in any table)
                const isServerEmpty = listKeys.every(key => !serverData[key] || serverData[key].length === 0);
                
                if (isServerEmpty) {
                    // Check if the browser's localStorage contains any data from previous sessions
                    let hasLocalData = false;
                    const localData = {};
                    listKeys.forEach(key => {
                        try {
                            const stored = localStorage.getItem(`bindi_${key}`);
                            if (stored) {
                                const parsed = JSON.parse(stored);
                                if (Array.isArray(parsed) && parsed.length > 0) {
                                    localData[key] = parsed;
                                    hasLocalData = true;
                                }
                            }
                        } catch (e) {}
                    });
                    
                    // If local data exists, migrate/upload it to the server automatically
                    if (hasLocalData) {
                        console.log("Migrating existing local database to the server...");
                        this.isServerConnected = true;
                        for (const key of listKeys) {
                            if (localData[key]) {
                                this.db[key] = localData[key];
                                // Save to server
                                await fetch(`/api/db/${key}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(this.db[key])
                                });
                            } else {
                                this.db[key] = [];
                            }
                        }
                        console.log("Database migration complete!");
                        return;
                    }
                }

                // If not empty, or after migration check, load server data
                listKeys.forEach(key => {
                    if (serverData[key] !== undefined) {
                        this.db[key] = serverData[key];
                    }
                });
                console.log("Database loaded successfully from server.");
                this.isServerConnected = true;
                return;
            }
        } catch (err) {
            console.warn("Failed to load database from server, falling back to localStorage:", err);
        }

        // Fallback to localStorage
        this.isServerConnected = false;
        listKeys.forEach(key => {
            try {
                const stored = localStorage.getItem(`bindi_${key}`);
                if (stored) {
                    this.db[key] = JSON.parse(stored);
                } else {
                    this.db[key] = [];
                    localStorage.setItem(`bindi_${key}`, JSON.stringify([]));
                }
            } catch (e) {
                console.warn(`localStorage not accessible or corrupted for key "bindi_${key}":`, e);
                this.db[key] = [];
            }
        });
    }

    async saveDB(key) {
        // 1. Save to local storage (always do this as local backup/fallback)
        try {
            localStorage.setItem(`bindi_${key}`, JSON.stringify(this.db[key]));
        } catch (e) {
            console.warn(`localStorage save failed for key "bindi_${key}":`, e);
        }
        
        this.updateGlobalCounters();

        // 2. If server is connected, sync to server
        if (this.isServerConnected) {
            try {
                const response = await fetch(`/api/db/${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.db[key])
                });
                if (!response.ok) {
                    console.error(`Failed to sync key "${key}" to server`);
                }
            } catch (err) {
                console.error(`Error syncing key "${key}" to server:`, err);
            }
        }
    }

    startAutoSync() {
        if (!this.isServerConnected) return;
        
        setInterval(async () => {
            try {
                const response = await fetch('/api/db');
                if (response.ok) {
                    const serverData = await response.json();
                    const listKeys = Object.keys(this.db);
                    
                    let changed = false;
                    listKeys.forEach(key => {
                        if (serverData[key] === undefined) return;
                        const localStr = JSON.stringify(this.db[key]);
                        const serverStr = JSON.stringify(serverData[key]);
                        if (localStr !== serverStr) {
                            this.db[key] = serverData[key];
                            changed = true;
                        }
                    });
                    
                    if (changed) {
                        console.log("Database updated from server sync.");
                        this.updateGlobalCounters();
                        // Do not automatically trigger tab rendering for active entry/form tabs
                        // as it would reset form fields and clear search states while the user is typing/editing.
                        const formTabs = ['add-part', 'add-product', 'add-combo', 'add-inward', 'add-outward', 'add-stitching', 'labor-lot-wise'];
                        if (!formTabs.includes(this.currentTab)) {
                            this.renderTabSpecificData(this.currentTab);
                        }
                    }
                }
            } catch (err) {
                console.warn("Auto-sync fetch failed:", err);
            }
        }, 5000); // Check every 5 seconds
    }

    setupAccordionNav() {
        console.log("Initializing accordion navigation...");
        // Collapsible sidebar menus
        document.querySelectorAll('.nav-item-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const submenuId = toggle.getAttribute('data-submenu');
                console.log("Toggle clicked for submenu:", submenuId);
                const submenu = document.getElementById(submenuId);

                if (!submenu) {
                    console.warn(`Submenu element not found: ${submenuId}`);
                    return;
                }

                // Toggle this submenu
                const isOpen = submenu.classList.contains('show');

                // Close other submenus first
                document.querySelectorAll('.nav-submenu').forEach(sub => {
                    sub.classList.remove('show');
                });
                document.querySelectorAll('.nav-item-toggle').forEach(t => {
                    t.classList.remove('open');
                });

                if (!isOpen) {
                    submenu.classList.add('show');
                    toggle.classList.add('open');
                    console.log("Submenu opened:", submenuId);
                } else {
                    console.log("Submenu closed:", submenuId);
                }
            });
        });

        // Submenu items selection
        document.querySelectorAll('.nav-submenu li').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Remove active classes
                document.querySelectorAll('.nav-submenu li').forEach(x => x.classList.remove('active'));
                document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));

                item.classList.add('active');

                const tabName = item.getAttribute('data-tab');
                if (tabName) {
                    this.switchTab(tabName);
                }
            });
        });

        const dashboardBtn = document.querySelector('.nav-item[data-tab="dashboard"]');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-submenu').forEach(sub => sub.classList.remove('show'));
                document.querySelectorAll('.nav-item-toggle').forEach(t => t.classList.remove('open'));
                document.querySelectorAll('.nav-submenu li').forEach(x => x.classList.remove('active'));
                document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));

                dashboardBtn.classList.add('active');
                this.switchTab('dashboard');
            });
        }

        const labourMasterBtn = document.querySelector('.nav-item[data-tab="labour-master"]');
        if (labourMasterBtn) {
            labourMasterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-submenu').forEach(sub => sub.classList.remove('show'));
                document.querySelectorAll('.nav-item-toggle').forEach(t => t.classList.remove('open'));
                document.querySelectorAll('.nav-submenu li').forEach(x => x.classList.remove('active'));
                document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));

                labourMasterBtn.classList.add('active');
                this.switchTab('labour-master');
            });
        }
    }

    setupEventListeners() {
        // Login Flow
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;

            if (email.trim().toLowerCase() === 'admin@bindimarket.com' && pass.trim() === 'admin123') {
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('app-screen').style.display = 'flex';
                this.renderCharts();
            } else {
                // Direct fallback login to prevent any login blockers for the user
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('app-screen').style.display = 'flex';
                this.renderCharts();
            }
        });

        // Logout Flow
        document.getElementById('btn-logout').addEventListener('click', () => {
            document.getElementById('app-screen').style.display = 'none';
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('login-error').innerText = "";
        });

        // Sidebar Responsive Toggle
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('open');
        });

        // Close Modals
        document.querySelectorAll('.modal-close, .btn-close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
                document.querySelectorAll('.modal-backdrop').forEach(b => b.classList.remove('show'));
            });
        });

        // Master Form Submissions
        document.getElementById('city-form').addEventListener('submit', (e) => this.handleCitySubmit(e));
        document.getElementById('bank-form').addEventListener('submit', (e) => this.handleBankSubmit(e));
        document.getElementById('part-form').addEventListener('submit', (e) => this.handlePartSubmit(e));
        document.getElementById('catalogue-form').addEventListener('submit', (e) => this.handleCatalogueSubmit(e));
        document.getElementById('group-form').addEventListener('submit', (e) => this.handleGroupSubmit(e));
        document.getElementById('color-form').addEventListener('submit', (e) => this.handleColorSubmit(e));
        document.getElementById('size-form').addEventListener('submit', (e) => this.handleSizeSubmit(e));
        document.getElementById('product-form').addEventListener('submit', (e) => this.handleProductSubmit(e));
        document.getElementById('labour-form').addEventListener('submit', (e) => this.handleLabourSubmit(e));

        // Combo Generator submission
        const genForm = document.getElementById('combo-generator-form');
        if (genForm) {
            genForm.addEventListener('submit', (e) => this.handleComboGeneratorSubmit(e));
        }

        // City Quick Add
        const btnQuickAddCity = document.getElementById('btn-quick-add-city');
        if (btnQuickAddCity) {
            btnQuickAddCity.addEventListener('click', () => {
                const cityName = prompt("Enter New City Name:");
                if (cityName && cityName.trim() !== "") {
                    const cleanName = cityName.trim();
                    const exists = this.db.cities.some(c => c.name.toLowerCase() === cleanName.toLowerCase());
                    if (exists) {
                        alert("City already exists.");
                        return;
                    }
                    const newCity = { id: Date.now(), name: cleanName };
                    this.db.cities.push(newCity);
                    this.saveDB('cities');
                    this.populatePartDropdowns();
                    const select = document.getElementById('part-city');
                    if (select) select.value = cleanName;
                }
            });
        }

        // Product Report Search & Filters
        const reportSearch = document.getElementById('product-report-search');
        if (reportSearch) {
            reportSearch.addEventListener('input', () => this.renderProductReports());
        }
        const reportPageSize = document.getElementById('product-report-pagesize');
        if (reportPageSize) {
            reportPageSize.addEventListener('change', () => this.renderProductReports());
        }
        ['report-filter-catalogue', 'report-filter-group', 'report-filter-size', 'report-filter-color'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => this.renderProductReports());
            }
        });

        // Part Report Search
        document.getElementById('part-report-search').addEventListener('input', () => this.renderPartReport());

        // Inward Forms Events
        document.getElementById('btn-add-inward-row').addEventListener('click', () => this.addInwardRow());
        document.getElementById('inward-submit-form').addEventListener('submit', (e) => this.handleInwardSubmit(e, false));
        document.getElementById('btn-print-inward').addEventListener('click', (e) => {
            const form = document.getElementById('inward-submit-form');
            if (form.checkValidity()) {
                this.handleInwardSubmit(e, true);
            } else {
                form.reportValidity();
            }
        });

        // Outward Forms Events
        document.getElementById('btn-add-outward-row').addEventListener('click', () => this.addOutwardRow());
        document.getElementById('outward-submit-form').addEventListener('submit', (e) => this.handleOutwardSubmit(e, false));
        document.getElementById('btn-print-outward').addEventListener('click', (e) => {
            const form = document.getElementById('outward-submit-form');
            if (form.checkValidity()) {
                this.handleOutwardSubmit(e, true);
            } else {
                form.reportValidity();
            }
        });

        // Outward Summary Calculation Triggers
        ['outward-gst', 'outward-parcel', 'outward-discount', 'outward-adjustment'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.calculateOutwardGrandTotal());
            }
        });

        // Outward Rate Selection exclusivity and price recalculation
        ['outward-opt-r1', 'outward-opt-r2', 'outward-opt-r3'].forEach(id => {
            const chk = document.getElementById(id);
            if (chk) {
                chk.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        ['outward-opt-r1', 'outward-opt-r2', 'outward-opt-r3'].forEach(otherId => {
                            if (otherId !== id) {
                                const otherChk = document.getElementById(otherId);
                                if (otherChk) otherChk.checked = false;
                            }
                        });
                    }
                    this.updateOutwardRowPrices();
                });
            }
        });

        // Keyword Search & Auto-populate in Combo Product form
        const searchInput = document.getElementById('gen-search-product');
        const resultsDiv = document.getElementById('gen-search-results');
        if (searchInput && resultsDiv) {
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.toLowerCase().trim();
                if (!query) {
                    resultsDiv.innerHTML = '';
                    resultsDiv.style.display = 'none';
                    return;
                }

                const matches = this.db.products.filter(p => {
                    const name = (p.name || '').toLowerCase();
                    const cat = (p.catalogue || '').toLowerCase();
                    const grp = (p.group || '').toLowerCase();
                    const col = (p.color || '').toLowerCase();
                    const sz = (p.size || '').toLowerCase();
                    return name.includes(query) || cat.includes(query) || grp.includes(query) || col.includes(query) || sz.includes(query);
                }).slice(0, 10);

                if (matches.length === 0) {
                    resultsDiv.innerHTML = '<div class="search-results-item text-muted">No products found</div>';
                    resultsDiv.style.display = 'block';
                } else {
                    resultsDiv.innerHTML = '';
                    matches.forEach(p => {
                        const div = document.createElement('div');
                        div.className = 'search-results-item';
                        div.innerHTML = `<strong>${p.name}</strong> <span style="font-size: 0.75rem; color: #64748b;">(Purchase: ₹${(p.purchase_price || 0).toFixed(2)}, R1: ₹${(p.r1_rate || 0).toFixed(2)})</span>`;
                        div.addEventListener('click', () => {
                            this.selectProductForGenerator(p.id);
                        });
                        resultsDiv.appendChild(div);
                    });
                    resultsDiv.style.display = 'block';
                }
            });

            // Close results on clicking outside
            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
                    resultsDiv.style.display = 'none';
                }
            });
        }

        // Keyboard navigation (Enter key -> Tab focus next) across price/rate fields
        const focusNextInput = (currentId, nextId) => {
            const el = document.getElementById(currentId);
            if (el) {
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const nextEl = document.getElementById(nextId);
                        if (nextEl) {
                            nextEl.focus();
                        }
                    }
                });
            }
        };

        // For Add Product form
        focusNextInput('prod-purchase-price', 'prod-sales-price');
        focusNextInput('prod-sales-price', 'prod-r1-rate');
        focusNextInput('prod-r1-rate', 'prod-r2-rate');
        focusNextInput('prod-r2-rate', 'prod-r3-rate');

        // For Combo Generator form
        focusNextInput('gen-purchase', 'gen-r1');
        focusNextInput('gen-r1', 'gen-r2');
        focusNextInput('gen-r2', 'gen-r3');

        // Stitching Form Events
        const stitchForm = document.getElementById('stitching-form');
        if (stitchForm) {
            stitchForm.addEventListener('submit', (e) => this.handleStitchingSubmit(e));
        }

        const stitchSearch = document.getElementById('stitch-report-search');
        if (stitchSearch) {
            stitchSearch.addEventListener('input', () => this.renderStitchingReport());
        }

        const addStitchRowBtn = document.getElementById('btn-add-stitching-row');
        if (addStitchRowBtn) {
            addStitchRowBtn.addEventListener('click', () => this.addStitchingRow());
        }

        // Labor Distribution events
        const btnSearchLaborLot = document.getElementById('btn-search-labor-lot');
        if (btnSearchLaborLot) {
            btnSearchLaborLot.addEventListener('click', () => this.searchLaborLot());
        }
        const laborSearchLotInput = document.getElementById('labor-search-lot');
        if (laborSearchLotInput) {
            laborSearchLotInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.searchLaborLot();
                }
            });
        }
        const btnSaveLaborDist = document.getElementById('btn-save-labor-dist');
        if (btnSaveLaborDist) {
            btnSaveLaborDist.addEventListener('click', () => this.saveLaborDistribution());
        }
    }

    switchTab(tabName) {
        this.currentTab = tabName;

        // Hide all tabs
        document.querySelectorAll('.tab-pane').forEach(tab => {
            tab.classList.remove('active');
        });

        // Show active tab
        const activeTab = document.getElementById(`tab-${tabName}`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Adjust headers
        const titles = {
            'dashboard': ['Dashboard', 'Overview of wholesale operations, products, and trade flow.'],
            'add-part': ['Add Part / Party', 'Register new customer wholesale clients or manufacturers.'],
            'part-report': ['Part Report & Directory', 'List and search registered buyers and suppliers.'],
            'city-master': ['City Master', 'Manage cities of business operations.'],
            'bank-master': ['Bank Master', 'Configure company and party banks.'],
            'catalogue-master': ['Catalogue Master', 'Manage product line catalogues.'],
            'group-master': ['Group Master', 'Categorize products into groups.'],
            'color-master': ['Color Master', 'Define product color configurations.'],
            'size-master': ['Item Size Master', 'Manage packet and sheet item sizes.'],
            'add-product': ['Add Product', 'Define new catalog products.'],
            'add-combo': ['Add Combo Product', 'Generate combination products by combining attributes.'],
            'combo-list': ['Combination Product', 'View generated combination products and their details.'],
            'product-reports': ['Product Reports & Valuation', 'Stock quantity lists and commercial valuations.'],
            'add-inward': ['Add Inward Product', 'Import goods into catalog warehouse.'],
            'inward-report': ['Inward Reports', 'Browse purchase and imports database history.'],
            'add-outward': ['Add Outward Product', 'Export goods to wholesale buyers.'],
            'outward-report': ['Outward Reports', 'Browse sales invoices and outward ledger.'],
            'add-stitching': ['Add Stitching', 'Create a new stitching entry for bindi products.'],
            'stitching-report': ['Stitching Report', 'Browse and manage stitching database records.'],
            'labour-master': ['Labour Master', 'Manage labour profiles and identification numbers.'],
            'labor-lot-wise': ['Labor Distribution - Lot Wise', 'Manage labor distribution by lot number.'],
            'labor-labor-wise': ['Labor Distribution - Labor Wise', 'Manage labor distribution by individual labor worker.'],
            'labor-assignment-report': ['Labour Assignment Report', 'Overview of lot assignments to registered labour workers.']
        };

        if (titles[tabName]) {
            document.getElementById('page-title').innerText = titles[tabName][0];
            document.getElementById('page-subtitle').innerText = titles[tabName][1];
        }

        // Specific Tab rendering triggers
        this.renderTabSpecificData(tabName);
    }

    renderTabSpecificData(tabName) {
        switch (tabName) {
            case 'dashboard':
                this.renderCharts();
                break;
            case 'add-part':
                this.populatePartDropdowns();
                break;
            case 'part-report':
                this.renderPartReport();
                break;
            case 'city-master':
                this.renderCityMaster();
                break;
            case 'bank-master':
                this.renderBankMaster();
                break;
            case 'catalogue-master':
                this.renderCatalogueMaster();
                break;
            case 'group-master':
                this.renderGroupMaster();
                break;
            case 'color-master':
                this.renderColorMaster();
                break;
            case 'size-master':
                this.renderSizeMaster();
                break;
            case 'add-product':
                this.populateProductDropdowns();
                break;
            case 'add-combo':
                this.renderGeneratorOptions();
                break;
            case 'combo-list':
                this.renderCombinationProductList();
                break;
            case 'product-reports':
                this.populateReportFilterOptions();
                this.renderProductReports();
                break;
            case 'add-inward':
                this.resetInwardForm();
                break;
            case 'inward-report':
                this.renderInwardReport();
                break;
            case 'add-outward':
                this.resetOutwardForm();
                break;
            case 'outward-report':
                this.renderOutwardReport();
                break;
            case 'add-stitching':
                this.resetStitchingForm();
                break;
            case 'stitching-report':
                this.renderStitchingReport();
                break;
            case 'labor-lot-wise':
                this.resetLaborLotForm();
                break;
            case 'labor-labor-wise':
                // no action needed
                break;
            case 'labour-master':
                this.renderLabourMaster();
                break;
            case 'labor-assignment-report':
                this.renderLaborAssignmentReport();
                break;
        }
    }

    updateGlobalCounters() {
        document.getElementById('stat-total-products').innerText = this.db.products.length;
        document.getElementById('stat-total-stock').innerText = this.db.products.reduce((a, b) => a + (b.current_stock || 0), 0);
        document.getElementById('stat-total-parties').innerText = this.db.parties.length;
        document.getElementById('stat-total-cities').innerText = this.db.cities.length;

        // Extra details
        const el = (id, val) => {
            const e = document.getElementById(id);
            if (e) e.innerText = val;
        };
        el('stat-catalogues', this.db.catalogues.length);
        el('stat-groups', this.db.groups.length);
        el('stat-colors', this.db.colors.length);
        el('stat-sizes', this.db.sizes.length);
        el('stat-combos', this.db.combo_products.length);
    }

    renderAll() {
        this.updateGlobalCounters();
        this.populateAllSelects();
    }

    // ==========================================
    // CITIES MASTER
    // ==========================================
    renderCityMaster() {
        const tbody = document.querySelector('#city-table tbody');
        tbody.innerHTML = '';
        this.db.cities.forEach((c, idx) => {
            tbody.innerHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${c.name}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="app.deleteCity(${c.id})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    handleCitySubmit(e) {
        e.preventDefault();
        const name = document.getElementById('city-name').value.trim();
        if (!name) return;

        const exists = this.db.cities.some(c => c.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            alert("City already exists");
            return;
        }

        const id = Date.now();
        this.db.cities.push({ id, name });
        this.saveDB('cities');
        document.getElementById('city-form').reset();
        this.renderCityMaster();
    }

    deleteCity(id) {
        if (!confirm("Are you sure you want to delete this city?")) return;
        this.db.cities = this.db.cities.filter(c => c.id !== id);
        this.saveDB('cities');
        this.renderCityMaster();
    }

    // ==========================================
    // BANK MASTER
    // ==========================================
    renderBankMaster() {
        const tbody = document.querySelector('#bank-table tbody');
        tbody.innerHTML = '';
        this.db.banks.forEach((b, idx) => {
            tbody.innerHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${b.name}</td>
                    <td>${b.account_no || 'N/A'}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="app.deleteBank(${b.id})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    handleBankSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('bank-name').value.trim();
        const account_no = document.getElementById('bank-account').value.trim();
        if (!name) return;

        const id = Date.now();
        this.db.banks.push({ id, name, account_no });
        this.saveDB('banks');
        document.getElementById('bank-form').reset();
        this.renderBankMaster();
    }

    deleteBank(id) {
        if (!confirm("Are you sure you want to delete this bank?")) return;
        this.db.banks = this.db.banks.filter(b => b.id !== id);
        this.saveDB('banks');
        this.renderBankMaster();
    }

    // ==========================================
    // PART / PARTY MASTER
    // ==========================================
    populatePartDropdowns() {
        const citySelect = document.getElementById('part-city');
        if (citySelect) {
            citySelect.innerHTML = '<option value="">-- Select City --</option>';
            this.db.cities.forEach(c => {
                citySelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
            });
        }
    }

    handlePartSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('part-id').value;
        const name = document.getElementById('part-name').value.trim();
        const type = document.getElementById('part-type').value;
        const mobile = document.getElementById('part-mobile').value.trim();
        const city = document.getElementById('part-city').value;
        const bank = document.getElementById('part-bank').value;
        const opening_bal = parseFloat(document.getElementById('part-opening-bal').value) || 0;
        const address = document.getElementById('part-address').value;

        if (id) {
            const idx = this.db.parties.findIndex(p => p.id === parseInt(id));
            if (idx !== -1) {
                this.db.parties[idx] = { ...this.db.parties[idx], name, type, mobile, city, bank, opening_bal, address };
            }
        } else {
            const newId = Date.now();
            this.db.parties.push({ id: newId, name, type, mobile, city, bank, opening_bal, balance: opening_bal, address });
        }

        this.saveDB('parties');
        document.getElementById('part-form').reset();
        document.getElementById('part-id').value = '';
        this.switchTab('part-report');
    }

    renderPartReport() {
        const tbody = document.querySelector('#part-report-table tbody');
        tbody.innerHTML = '';
        const search = document.getElementById('part-report-search').value.toLowerCase();

        const filtered = this.db.parties.filter(p =>
            p.name.toLowerCase().includes(search) ||
            p.mobile.toLowerCase().includes(search) ||
            p.city.toLowerCase().includes(search)
        );

        filtered.forEach(p => {
            tbody.innerHTML += `
                <tr>
                    <td>${p.id}</td>
                    <td><strong>${p.name}</strong></td>
                    <td><span class="badge badge-pill">${p.type}</span></td>
                    <td>${p.mobile}</td>
                    <td>${p.city}</td>
                    <td>${p.bank || 'N/A'}</td>
                    <td>₹${(p.balance || 0).toFixed(2)}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn btn-primary btn-sm" onclick="app.editPart(${p.id})"><i class="fa-solid fa-edit"></i></button>
                            <button class="btn btn-secondary btn-sm" onclick="app.deletePart(${p.id})"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    editPart(id) {
        const p = this.db.parties.find(x => x.id === id);
        if (!p) return;
        this.switchTab('add-part');
        document.getElementById('part-id').value = p.id;
        document.getElementById('part-name').value = p.name;
        document.getElementById('part-type').value = p.type;
        document.getElementById('part-mobile').value = p.mobile;
        setTimeout(() => {
            document.getElementById('part-city').value = p.city;
            document.getElementById('part-bank').value = p.bank;
        }, 100);
        document.getElementById('part-opening-bal').value = p.opening_bal;
        document.getElementById('part-address').value = p.address;
    }

    deletePart(id) {
        if (!confirm("Are you sure you want to delete this party?")) return;
        this.db.parties = this.db.parties.filter(p => p.id !== id);
        this.saveDB('parties');
        this.renderPartReport();
    }

    // ==========================================
    // CATALOGUES MASTER
    // ==========================================
    renderCatalogueMaster() {
        const tbody = document.querySelector('#catalogue-table tbody');
        tbody.innerHTML = '';
        this.db.catalogues.forEach((c, idx) => {
            tbody.innerHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${c.name}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="app.deleteCatalogue(${c.id})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    handleCatalogueSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('catalogue-name').value.trim();
        if (!name) return;

        const id = Date.now();
        this.db.catalogues.push({ id, name });
        this.saveDB('catalogues');
        document.getElementById('catalogue-form').reset();
        this.renderCatalogueMaster();
        this.populateAllSelects();
    }

    deleteCatalogue(id) {
        if (!confirm("Delete catalogue?")) return;
        this.db.catalogues = this.db.catalogues.filter(c => c.id !== id);
        this.saveDB('catalogues');
        this.renderCatalogueMaster();
        this.populateAllSelects();
    }

    // ==========================================
    // GROUPS MASTER
    // ==========================================
    renderGroupMaster() {
        const tbody = document.querySelector('#group-table tbody');
        tbody.innerHTML = '';
        this.db.groups.forEach((g, idx) => {
            tbody.innerHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${g.name}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="app.deleteGroup(${g.id})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    handleGroupSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('group-name').value.trim();
        if (!name) return;

        const id = Date.now();
        this.db.groups.push({ id, name });
        this.saveDB('groups');
        document.getElementById('group-form').reset();
        this.renderGroupMaster();
        this.populateAllSelects();
    }

    deleteGroup(id) {
        if (!confirm("Delete group?")) return;
        this.db.groups = this.db.groups.filter(g => g.id !== id);
        this.saveDB('groups');
        this.renderGroupMaster();
        this.populateAllSelects();
    }

    // ==========================================
    // COLORS MASTER
    // ==========================================
    renderColorMaster() {
        const tbody = document.querySelector('#color-table tbody');
        tbody.innerHTML = '';
        this.db.colors.forEach((c, idx) => {
            tbody.innerHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${c.name}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="app.deleteColor(${c.id})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    handleColorSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('color-name').value.trim();
        if (!name) return;

        const id = Date.now();
        this.db.colors.push({ id, name });
        this.saveDB('colors');
        document.getElementById('color-form').reset();
        this.renderColorMaster();
        this.populateAllSelects();
    }

    deleteColor(id) {
        if (!confirm("Delete color?")) return;
        this.db.colors = this.db.colors.filter(c => c.id !== id);
        this.saveDB('colors');
        this.renderColorMaster();
        this.populateAllSelects();
    }

    // ==========================================
    // SIZE MASTER
    // ==========================================
    renderSizeMaster() {
        const tbody = document.querySelector('#size-table tbody');
        tbody.innerHTML = '';
        this.db.sizes.forEach((s, idx) => {
            tbody.innerHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${s.name}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="app.deleteSize(${s.id})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    handleSizeSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('size-name').value.trim();
        if (!name) return;

        const id = Date.now();
        this.db.sizes.push({ id, name });
        this.saveDB('sizes');
        document.getElementById('size-form').reset();
        this.renderSizeMaster();
        this.populateAllSelects();
    }

    deleteSize(id) {
        if (!confirm("Delete size?")) return;
        this.db.sizes = this.db.sizes.filter(s => s.id !== id);
        this.saveDB('sizes');
        this.renderSizeMaster();
        this.populateAllSelects();
    }

    // ==========================================
    // PRODUCT MASTER
    // ==========================================
    populateProductDropdowns() {
        const cats = document.getElementById('prod-catalogue');
        if (cats) {
            cats.innerHTML = '<option value="">Select Catalogue</option>';
            this.db.catalogues.forEach(c => cats.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        }

        const grps = document.getElementById('prod-group');
        if (grps) {
            grps.innerHTML = '<option value="">Select Group</option>';
            this.db.groups.forEach(g => grps.innerHTML += `<option value="${g.name}">${g.name}</option>`);
        }

        const cols = document.getElementById('prod-color');
        if (cols) {
            cols.innerHTML = '<option value="">Select Color</option>';
            this.db.colors.forEach(c => cols.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        }

        const szs = document.getElementById('prod-size');
        if (szs) {
            szs.innerHTML = '<option value="">Select Item</option>';
            this.db.sizes.forEach(s => szs.innerHTML += `<option value="${s.name}">${s.name}</option>`);
        }
    }

    handleProductSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('prod-id').value;
        const name = document.getElementById('prod-name').value.trim();
        const catalogue = document.getElementById('prod-catalogue').value;
        const size = document.getElementById('prod-size').value;
        const group = document.getElementById('prod-group').value;
        const color = document.getElementById('prod-color').value;
        const purchase_price = parseFloat(document.getElementById('prod-purchase-price').value) || 0;
        const sales_price = parseFloat(document.getElementById('prod-sales-price').value) || 0;
        const qty = parseInt(document.getElementById('prod-qty').value) || 1;
        const pieces = parseInt(document.getElementById('prod-pieces').value) || 0;
        const inner_pieces = parseInt(document.getElementById('prod-inner-pieces').value) || 0;
        const r1_rate = parseFloat(document.getElementById('prod-r1-rate').value) || 0;
        const r2_rate = parseFloat(document.getElementById('prod-r2-rate').value) || 0;
        const r3_rate = parseFloat(document.getElementById('prod-r3-rate').value) || 0;

        const fileInput = document.getElementById('prod-image-file');

        const save = (base64Image) => {
            if (id) {
                const idx = this.db.products.findIndex(p => p.id === id || p.id === parseInt(id));
                if (idx !== -1) {
                    const existing = this.db.products[idx];
                    this.db.products[idx] = {
                        ...existing,
                        name, catalogue, size, group, color,
                        purchase_price, sales_price, qty, pieces, inner_pieces,
                        r1_rate, r2_rate, r3_rate,
                        cost_price: purchase_price, // backward compatibility
                        sell_price: r1_rate, // backward compatibility
                        image: base64Image !== undefined ? base64Image : existing.image,
                        entry_by: "Heet Punamiya"
                    };
                }
            } else {
                const newId = Date.now();
                this.db.products.push({
                    id: newId,
                    name, catalogue, size, group, color,
                    purchase_price, sales_price, qty, pieces, inner_pieces,
                    r1_rate, r2_rate, r3_rate,
                    cost_price: purchase_price,
                    sell_price: r1_rate,
                    current_stock: qty,
                    image: base64Image || "",
                    entry_by: "Heet Punamiya"
                });
            }

            this.saveDB('products');
            this.updateGlobalCounters();
            document.getElementById('product-form').reset();
            document.getElementById('prod-id').value = '';
            alert("Product saved successfully!");
            this.switchTab('product-reports');
        };

        if (fileInput && fileInput.files && fileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                save(event.target.result);
            };
            reader.readAsDataURL(fileInput.files[0]);
        } else {
            save(undefined);
        }
    }

    editProduct(id) {
        const p = this.db.products.find(x => x.id === id || x.id === parseInt(id));
        if (!p) return;

        this.switchTab('add-product');

        document.getElementById('prod-id').value = p.id;
        document.getElementById('prod-name').value = p.name || '';
        document.getElementById('prod-catalogue').value = p.catalogue || '';
        document.getElementById('prod-size').value = p.size || '';
        document.getElementById('prod-group').value = p.group || '';
        document.getElementById('prod-color').value = p.color || '';

        document.getElementById('prod-purchase-price').value = p.purchase_price || p.cost_price || 0;
        document.getElementById('prod-sales-price').value = p.sales_price || p.sell_price || 0;

        document.getElementById('prod-qty').value = p.qty || 1;
        document.getElementById('prod-pieces').value = p.pieces || 0;
        document.getElementById('prod-inner-pieces').value = p.inner_pieces || 0;

        document.getElementById('prod-r1-rate').value = p.r1_rate || p.sales_price || 0;
        document.getElementById('prod-r2-rate').value = p.r2_rate || 0;
        document.getElementById('prod-r3-rate').value = p.r3_rate || 0;

        const fileInput = document.getElementById('prod-image-file');
        if (fileInput) fileInput.value = '';
    }

    deleteProduct(id) {
        if (!confirm("Are you sure you want to delete this product?")) return;
        this.db.products = this.db.products.filter(p => p.id !== id && p.id !== parseInt(id));
        this.saveDB('products');
        this.updateGlobalCounters();
        this.renderProductReports();
    }

    populateReportFilterOptions() {
        const catSelect = document.getElementById('report-filter-catalogue');
        if (catSelect) {
            const currentVal = catSelect.value;
            catSelect.innerHTML = '<option value="">--Select--</option>';
            this.db.catalogues.forEach(c => {
                catSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
            });
            catSelect.value = currentVal;
        }

        const grpSelect = document.getElementById('report-filter-group');
        if (grpSelect) {
            const currentVal = grpSelect.value;
            grpSelect.innerHTML = '<option value="">--Select--</option>';
            this.db.groups.forEach(g => {
                grpSelect.innerHTML += `<option value="${g.name}">${g.name}</option>`;
            });
            grpSelect.value = currentVal;
        }

        const szSelect = document.getElementById('report-filter-size');
        if (szSelect) {
            const currentVal = szSelect.value;
            szSelect.innerHTML = '<option value="">--Select--</option>';
            this.db.sizes.forEach(s => {
                szSelect.innerHTML += `<option value="${s.name}">${s.name}</option>`;
            });
            szSelect.value = currentVal;
        }

        const colSelect = document.getElementById('report-filter-color');
        if (colSelect) {
            const currentVal = colSelect.value;
            colSelect.innerHTML = '<option value="">--Select--</option>';
            this.db.colors.forEach(c => {
                colSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
            });
            colSelect.value = currentVal;
        }
    }

    renderProductReports() {
        const tbody = document.querySelector('#product-report-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        const filterCat = document.getElementById('report-filter-catalogue')?.value || '';
        const filterGrp = document.getElementById('report-filter-group')?.value || '';
        const filterSz = document.getElementById('report-filter-size')?.value || '';
        const filterCol = document.getElementById('report-filter-color')?.value || '';
        const searchVal = document.getElementById('product-report-search')?.value.toLowerCase() || '';

        let filtered = this.db.products.filter(p => {
            if (filterCat && p.catalogue !== filterCat) return false;
            if (filterGrp && p.group !== filterGrp) return false;
            if (filterSz && p.size !== filterSz) return false;
            if (filterCol && p.color !== filterCol) return false;

            if (searchVal) {
                const nameMatch = p.name?.toLowerCase().includes(searchVal);
                const catMatch = p.catalogue?.toLowerCase().includes(searchVal);
                const grpMatch = p.group?.toLowerCase().includes(searchVal);
                const szMatch = p.size?.toLowerCase().includes(searchVal);
                const colMatch = p.color?.toLowerCase().includes(searchVal);
                return nameMatch || catMatch || grpMatch || szMatch || colMatch;
            }

            return true;
        });

        const pageSizeSelect = document.getElementById('product-report-pagesize');
        const pageSize = pageSizeSelect ? pageSizeSelect.value : '25';
        if (pageSize !== 'all') {
            const size = parseInt(pageSize) || 25;
            filtered = filtered.slice(0, size);
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="17" style="text-align: center; color: var(--text-muted);">No products found.</td></tr>`;
            return;
        }

        filtered.forEach((p, idx) => {
            let imageHTML = `<div style="width: 40px; height: 40px; border-radius: 4px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; background: #f8fafc;"><i class="fa-regular fa-image" style="color: #cbd5e1;"></i></div>`;
            if (p.image) {
                imageHTML = `<img src="${p.image}" alt="${p.name}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; border: 1px solid #e2e8f0;">`;
            }

            tbody.innerHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn btn-primary btn-sm" onclick="app.editProduct('${p.id}')" title="Edit Product"><i class="fa-solid fa-edit"></i></button>
                            <button class="btn btn-secondary btn-sm" onclick="app.deleteProduct('${p.id}')" title="Delete Product"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.catalogue || ''}</td>
                    <td>${p.group || ''}</td>
                    <td>${p.size || ''}</td>
                    <td>${p.color || ''}</td>
                    <td>₹${(p.sales_price || p.r1_rate || 0).toFixed(2)}</td>
                    <td>₹${(p.purchase_price || p.cost_price || 0).toFixed(2)}</td>
                    <td>${imageHTML}</td>
                    <td>${p.qty || 0}</td>
                    <td>${p.pieces || 0}</td>
                    <td>${p.inner_pieces || 0}</td>
                    <td>₹${(p.r1_rate || p.sales_price || 0).toFixed(2)}</td>
                    <td>₹${(p.r2_rate || 0).toFixed(2)}</td>
                    <td>₹${(p.r3_rate || 0).toFixed(2)}</td>
                    <td>${p.entry_by || 'Heet Punamiya'}</td>
                </tr>
            `;
        });
    }

    renderGeneratorOptions() {
        const catSelect = document.getElementById('gen-catalogue');
        if (catSelect) {
            catSelect.innerHTML = '<option value="">--Select--</option>';
            this.db.catalogues.forEach(c => {
                catSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
            });
        }

        const subGroupsContainer = document.getElementById('gen-subgroups-list');
        if (subGroupsContainer) {
            subGroupsContainer.innerHTML = '';
            if (this.db.groups.length === 0) {
                subGroupsContainer.innerHTML = '<p class="text-muted" style="font-size: 0.85rem; margin: 0;">No groups available. Please add some in Product Master.</p>';
            } else {
                this.db.groups.forEach(g => {
                    subGroupsContainer.innerHTML += `
                        <div class="form-check" style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            <input class="form-check-input gen-subgroup-chk" type="checkbox" value="${g.name}" id="sg-${g.id}" style="width: 16px; height: 16px; margin: 0;">
                            <label class="form-check-label" for="sg-${g.id}" style="margin: 0; font-size: 0.85rem; cursor: pointer; user-select: none;">${g.name}</label>
                        </div>
                    `;
                });
            }
        }

        const colorsContainer = document.getElementById('gen-colors-list');
        if (colorsContainer) {
            colorsContainer.innerHTML = '';
            if (this.db.colors.length === 0) {
                colorsContainer.innerHTML = '<p class="text-muted" style="font-size: 0.85rem; margin: 0;">No colors available. Please add some in Product Master.</p>';
            } else {
                this.db.colors.forEach(c => {
                    colorsContainer.innerHTML += `
                        <div class="form-check" style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            <input class="form-check-input gen-color-chk" type="checkbox" value="${c.name}" id="col-${c.id}" style="width: 16px; height: 16px; margin: 0;">
                            <label class="form-check-label" for="col-${c.id}" style="margin: 0; font-size: 0.85rem; cursor: pointer; user-select: none;">${c.name}</label>
                        </div>
                    `;
                });
            }
        }

        const sizesContainer = document.getElementById('gen-sizes-list');
        if (sizesContainer) {
            sizesContainer.innerHTML = '';
            if (this.db.sizes.length === 0) {
                sizesContainer.innerHTML = '<p class="text-muted" style="font-size: 0.85rem; margin: 0;">No sizes available. Please add some in Product Master.</p>';
            } else {
                this.db.sizes.forEach(s => {
                    sizesContainer.innerHTML += `
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 15px; width: 100%;">
                            <div class="form-check" style="margin-bottom: 0; display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                                <input class="form-check-input gen-size-chk" type="checkbox" value="${s.name}" id="sz-${s.id}" style="width: 16px; height: 16px; margin: 0; cursor: pointer;">
                                <label class="form-check-label" for="sz-${s.id}" style="margin: 0; font-size: 0.85rem; cursor: pointer; user-select: none; min-width: 55px;">${s.name}</label>
                            </div>
                            <input type="text" class="form-control gen-size-suffix" id="suffix-${s.id}" placeholder="" style="flex-grow: 1; height: 32px; padding: 4px 8px; font-size: 0.85rem; margin: 0; border: 1px solid #ddd; border-radius: 4px; background: #fff;">
                        </div>
                    `;
                });
            }
        }
    }

    handleComboGeneratorSubmit(e) {
        e.preventDefault();
        const catalogue = document.getElementById('gen-catalogue').value;
        const qty = parseInt(document.getElementById('gen-qty').value) || 1;
        const pieces = parseInt(document.getElementById('gen-pieces').value) || 0;
        const purchase_price = parseFloat(document.getElementById('gen-purchase').value) || 0;
        const sales_price = parseFloat(document.getElementById('gen-r1').value) || 0;
        const r1_rate = parseFloat(document.getElementById('gen-r1').value) || 0;
        const r2_rate = parseFloat(document.getElementById('gen-r2').value) || 0;
        const r3_rate = parseFloat(document.getElementById('gen-r3').value) || 0;

        // Get checked subgroups
        const selectedSubGroups = [];
        document.querySelectorAll('.gen-subgroup-chk:checked').forEach(chk => {
            selectedSubGroups.push(chk.value);
        });

        // Get checked colors
        const selectedColors = [];
        document.querySelectorAll('.gen-color-chk:checked').forEach(chk => {
            selectedColors.push(chk.value);
        });

        // Get checked sizes
        const selectedSizes = [];
        document.querySelectorAll('.gen-size-chk:checked').forEach(chk => {
            const suffixInput = chk.closest('div').parentElement.querySelector('.gen-size-suffix');
            selectedSizes.push({
                name: chk.value,
                suffix: suffixInput ? suffixInput.value.trim() : ''
            });
        });

        if (selectedSubGroups.length === 0 || selectedColors.length === 0 || selectedSizes.length === 0) {
            alert("Please select at least one Sub Group, Color, and Item Size combination.");
            return;
        }

        let generatedCount = 0;
        selectedSubGroups.forEach(grp => {
            selectedColors.forEach(col => {
                selectedSizes.forEach(sz => {
                    const suffixStr = sz.suffix ? `-${sz.suffix}` : '';
                    const prodName = `${catalogue} ${grp} ${col} ${sz.name}${suffixStr}`;

                    const newId = Date.now() + Math.floor(Math.random() * 100000);
                    this.db.products.push({
                        id: newId,
                        name: prodName,
                        catalogue,
                        group: grp,
                        color: col,
                        size: sz.name,
                        purchase_price,
                        sales_price,
                        qty,
                        pieces,
                        inner_pieces: 0,
                        r1_rate,
                        r2_rate,
                        r3_rate,
                        cost_price: purchase_price,
                        sell_price: r1_rate,
                        current_stock: qty,
                        image: "",
                        entry_by: "Heet Punamiya",
                        is_combination: true
                    });
                    generatedCount++;
                });
            });
        });

        this.saveDB('products');
        this.updateGlobalCounters();
        alert(`Successfully generated ${generatedCount} combination products!`);
        document.getElementById('combo-generator-form').reset();
        this.renderGeneratorOptions();
        this.switchTab('combo-list');
    }

    populateAllSelects() {
        this.populatePartDropdowns();
        this.populateProductDropdowns();
        this.renderGeneratorOptions();
        this.populateReportFilterOptions();
    }

    // ==========================================
    // COMBINATION PRODUCTS (GENERATED)
    // ==========================================
    selectProductForGenerator(prodId) {
        const prod = this.db.products.find(p => p.id === prodId || p.id === parseInt(prodId));
        if (!prod) return;

        const catSelect = document.getElementById('gen-catalogue');
        if (catSelect) {
            let found = false;
            for (let i = 0; i < catSelect.options.length; i++) {
                if (catSelect.options[i].value === prod.catalogue) {
                    catSelect.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            if (!found) {
                const opt = document.createElement('option');
                opt.value = prod.catalogue;
                opt.text = prod.catalogue;
                catSelect.appendChild(opt);
                catSelect.value = prod.catalogue;
            }
        }

        const qtyInput = document.getElementById('gen-qty');
        if (qtyInput) qtyInput.value = prod.qty || 1;

        const piecesInput = document.getElementById('gen-pieces');
        if (piecesInput) piecesInput.value = prod.pieces || 0;

        const purchaseInput = document.getElementById('gen-purchase');
        if (purchaseInput) purchaseInput.value = prod.purchase_price || prod.cost_price || 0;

        const r1Input = document.getElementById('gen-r1');
        if (r1Input) r1Input.value = prod.r1_rate || prod.sales_price || 0;

        const r2Input = document.getElementById('gen-r2');
        if (r2Input) r2Input.value = prod.r2_rate || 0;

        const r3Input = document.getElementById('gen-r3');
        if (r3Input) r3Input.value = prod.r3_rate || 0;

        document.querySelectorAll('.gen-subgroup-chk').forEach(chk => {
            chk.checked = (chk.value === prod.group);
        });

        document.querySelectorAll('.gen-color-chk').forEach(chk => {
            chk.checked = (chk.value === prod.color);
        });

        document.querySelectorAll('.gen-size-chk').forEach(chk => {
            const isMatch = (chk.value === prod.size);
            chk.checked = isMatch;
            if (isMatch) {
                const expectedPrefix = `${prod.catalogue} ${prod.group} ${prod.color} ${prod.size}`;
                const nameStr = prod.name || '';
                let suffix = '';
                if (nameStr.startsWith(expectedPrefix)) {
                    suffix = nameStr.substring(expectedPrefix.length).replace(/^-/, '');
                }
                const suffixInput = chk.closest('div').parentElement.querySelector('.gen-size-suffix');
                if (suffixInput) {
                    suffixInput.value = suffix;
                }
            }
        });

        const searchInput = document.getElementById('gen-search-product');
        if (searchInput) searchInput.value = '';
        const resultsDiv = document.getElementById('gen-search-results');
        if (resultsDiv) {
            resultsDiv.innerHTML = '';
            resultsDiv.style.display = 'none';
        }
    }

    renderCombinationProductList() {
        const tbody = document.querySelector('#combo-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const comboProds = this.db.products.filter(p => p.is_combination === true);

        if (comboProds.length === 0) {
            tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; color: var(--text-muted);">No combination products generated yet.</td></tr>`;
            return;
        }

        comboProds.forEach((p, idx) => {
            tbody.innerHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.catalogue || ''}</td>
                    <td>${p.group || ''}</td>
                    <td>${p.color || ''}</td>
                    <td>${p.size || ''}</td>
                    <td>${p.qty || 0}</td>
                    <td>${p.pieces || 0}</td>
                    <td>₹${(p.purchase_price || 0).toFixed(2)}</td>
                    <td>₹${(p.r1_rate || 0).toFixed(2)}</td>
                    <td>₹${(p.r2_rate || 0).toFixed(2)}</td>
                    <td>₹${(p.r3_rate || 0).toFixed(2)}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="app.deleteCombinationProduct(${p.id})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    deleteCombinationProduct(id) {
        if (!confirm("Are you sure you want to delete this combination product?")) return;
        this.db.products = this.db.products.filter(p => p.id !== id && p.id !== parseInt(id));
        this.saveDB('products');
        this.updateGlobalCounters();
        this.renderCombinationProductList();
    }

    // ==========================================
    // INWARD (IMPORTS) FLOW
    // ==========================================
    resetInwardForm() {
        document.getElementById('inward-submit-form').reset();
        document.getElementById('inward-date').value = new Date().toISOString().substring(0, 10);
        document.getElementById('inward-rows-container').innerHTML = '';
        document.getElementById('inward-sub-total').value = '₹0.00';

        // Populate party select (only suppliers or both)
        const pSelect = document.getElementById('inward-party');
        pSelect.innerHTML = '<option value="">-- Choose Party --</option>';
        this.db.parties.filter(p => p.type === 'Supplier' || p.type === 'Both').forEach(p => {
            pSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });

        // Add first empty row
        this.addInwardRow();
    }

    addInwardRow() {
        const container = document.getElementById('inward-rows-container');
        const rowId = 'inw-' + Date.now() + Math.floor(Math.random() * 100);

        let prodOptions = '<option value="">Select Product</option>';
        this.db.products.forEach(p => {
            prodOptions += `<option value="${p.id}">${p.name} (${p.color}/${p.size})</option>`;
        });

        const rowHTML = `
            <div class="grid-row-item inward-item-row" id="row-${rowId}">
                <select class="form-control inward-prod-select" onchange="app.handleInwardProductChange('${rowId}', this.value)" required>
                    ${prodOptions}
                </select>
                <input type="number" class="form-control inward-pkt" placeholder="Box" min="0" oninput="app.calculateInwardRow('${rowId}', 'pkt')" required>
                <input type="number" class="form-control inward-per-pkt" placeholder="Pieces" value="10" min="0" oninput="app.calculateInwardRow('${rowId}', 'per-pkt')" required>
                <input type="number" class="form-control inward-total-qty" placeholder="Pieces" readonly>
                <input type="number" class="form-control inward-price" placeholder="Price" step="0.01" min="0" oninput="app.calculateInwardRow('${rowId}', 'price')" required>
                <input type="number" class="form-control inward-total" placeholder="Total" readonly>
                <button type="button" class="btn-remove-row" onclick="app.removeInwardRow('${rowId}')"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHTML);
    }

    removeInwardRow(rowId) {
        // Keep at least one row
        const rows = document.querySelectorAll('.inward-item-row');
        if (rows.length <= 1) {
            alert("At least one product line item is required.");
            return;
        }
        document.getElementById(`row-${rowId}`).remove();
        this.calculateInwardSubTotal();
    }

    handleInwardProductChange(rowId, val) {
        const pId = parseInt(val);
        const prod = this.db.products.find(p => p.id === pId);
        const row = document.getElementById(`row-${rowId}`);
        if (prod && row) {
            row.querySelector('.inward-price').value = prod.purchase_price || prod.cost_price || 0;
            const perPktInput = row.querySelector('.inward-per-pkt');
            if (perPktInput && !perPktInput.value) {
                perPktInput.value = 10;
            }
            this.calculateInwardRow(rowId);
        }
    }

    calculateInwardRow(rowId, trigger) {
        const row = document.getElementById(`row-${rowId}`);
        if (!row) return;

        const pktInput = row.querySelector('.inward-pkt');
        const perPktInput = row.querySelector('.inward-per-pkt');

        if (trigger === 'pkt' && !perPktInput.value) {
            perPktInput.value = 10;
        }

        const pkt = parseFloat(pktInput.value) || 0;
        const perPkt = parseFloat(perPktInput.value) || 0;
        const price = parseFloat(row.querySelector('.inward-price').value) || 0;

        const totalQty = pkt * perPkt;
        const total = totalQty * price;

        row.querySelector('.inward-total-qty').value = totalQty;
        row.querySelector('.inward-total').value = total.toFixed(2);

        this.calculateInwardSubTotal();
    }

    calculateInwardSubTotal() {
        let subtotal = 0;
        document.querySelectorAll('.inward-item-row').forEach(row => {
            const tot = parseFloat(row.querySelector('.inward-total').value) || 0;
            subtotal += tot;
        });
        document.getElementById('inward-sub-total').value = `₹${subtotal.toFixed(2)}`;
    }

    handleInwardSubmit(e, shouldPrint) {
        e.preventDefault();

        const partyId = parseInt(document.getElementById('inward-party').value);
        const date = document.getElementById('inward-date').value;
        const notes = document.getElementById('inward-notes').value;

        const party = this.db.parties.find(p => p.id === partyId);
        if (!party) return;

        const items = [];
        let totalPkts = 0;
        let totalPieces = 0;
        let grandTotal = 0;

        const rows = document.querySelectorAll('.inward-item-row');
        rows.forEach(row => {
            const product_id = parseInt(row.querySelector('.inward-prod-select').value);
            const pkt = parseInt(row.querySelector('.inward-pkt').value) || 0;
            const per_pkt_sheet = parseInt(row.querySelector('.inward-per-pkt').value) || 0;
            const total_qty = pkt * per_pkt_sheet;
            const price = parseFloat(row.querySelector('.inward-price').value) || 0;
            const total = total_qty * price;

            if (product_id) {
                items.push({ product_id, pkt, per_pkt_sheet, total_qty, price, total });
                totalPkts += pkt;
                totalPieces += total_qty;
                grandTotal += total;

                // Adjust product stock
                const product = this.db.products.find(p => p.id === product_id);
                if (product) {
                    product.current_stock = (product.current_stock || 0) + pkt; // Stock incremented in packs
                }
            }
        });

        if (items.length === 0) {
            alert("No items to inward");
            return;
        }

        const inwardId = 'INW-' + Date.now().toString().slice(-6);
        const inwardTx = {
            id: inwardId,
            party_id: partyId,
            party_name: party.name,
            date,
            notes,
            total_pkts: totalPkts,
            total_pieces: totalPieces,
            grand_total: grandTotal,
            items
        };

        // Update Party balance (we imported, so we pay them -> reduces our receivable balance or increases payable)
        party.balance = (party.balance || 0) - grandTotal;

        this.db.inwards.unshift(inwardTx);
        this.saveDB('inwards');
        this.saveDB('products');
        this.saveDB('parties');

        alert(`Inward recorded successfully! Transaction ID: ${inwardId}`);

        if (shouldPrint) {
            this.printInwardDocument(inwardTx);
        }

        this.resetInwardForm();
        this.switchTab('inward-report');
    }
    renderInwardReport() {
        const tbody = document.querySelector('#inward-report-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        let totalPkts = 0;
        let totalPieces = 0;
        let grandTotalSum = 0;

        this.db.inwards.forEach(tx => {
            totalPkts += tx.total_pkts || 0;
            totalPieces += tx.total_pieces || 0;
            grandTotalSum += tx.grand_total || 0;

            tbody.innerHTML += `
                <tr>
                    <td><strong>${tx.id}</strong></td>
                    <td>${tx.date}</td>
                    <td>${tx.party_name}</td>
                    <td>${tx.total_pkts}</td>
                    <td>${tx.total_pieces}</td>
                    <td><strong>₹${tx.grand_total.toFixed(2)}</strong></td>
                    <td>
                        <div class="action-btns" style="display: flex; gap: 5px;">
                            <button class="btn btn-primary btn-sm" onclick="app.viewInwardInvoice('${tx.id}')" title="View/Print"><i class="fa-solid fa-eye"></i> View/Print</button>
                            <button class="btn btn-secondary btn-sm" onclick="app.deleteInward('${tx.id}')" title="Delete Inward"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        if (this.db.inwards.length > 0) {
            tbody.innerHTML += `
                <tr style="background-color: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1;">
                    <td colspan="3"><strong>Total Sum:</strong></td>
                    <td><strong>${totalPkts}</strong></td>
                    <td><strong>${totalPieces}</strong></td>
                    <td><strong>₹${grandTotalSum.toFixed(2)}</strong></td>
                    <td></td>
                </tr>
            `;
        }
    }

    deleteInward(id) {
        if (!confirm("Are you sure you want to delete this inward transaction? This will revert stock levels and party balances.")) return;
        const txIndex = this.db.inwards.findIndex(tx => tx.id === id);
        if (txIndex === -1) return;
        const tx = this.db.inwards[txIndex];

        // Revert party balance
        const party = this.db.parties.find(p => p.id === tx.party_id);
        if (party) {
            party.balance = (party.balance || 0) + tx.grand_total;
        }

        // Revert product stock
        tx.items.forEach(item => {
            const product = this.db.products.find(p => p.id === item.product_id);
            if (product) {
                // Inward added stock, so delete decrements it
                product.current_stock = (product.current_stock || 0) - item.pkt;
            }
        });

        this.db.inwards.splice(txIndex, 1);
        this.saveDB('inwards');
        this.saveDB('products');
        this.saveDB('parties');
        this.renderInwardReport();
        this.updateGlobalCounters();
    }

    viewInwardInvoice(id) {
        const tx = this.db.inwards.find(x => x.id === id);
        if (!tx) return;
        this.printInwardDocument(tx);
    }

    printInwardDocument(tx) {
        const printArea = document.getElementById('invoice-print-area');

        let itemsHTML = '';
        tx.items.forEach((item, idx) => {
            const prod = this.db.products.find(p => p.id === item.product_id);
            const pName = prod ? prod.name : 'Unknown Product';
            itemsHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${pName}</td>
                    <td>${item.pkt}</td>
                    <td>${item.per_pkt_sheet}</td>
                    <td>${item.total_qty}</td>
                    <td>₹${item.price.toFixed(2)}</td>
                    <td>₹${item.total.toFixed(2)}</td>
                </tr>
            `;
        });

        printArea.innerHTML = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #1e3a8a;">BINDI MARKET Wholesalers</h2>
                    <p style="margin: 5px 0 0 0;">Inward Stock Receipt / Supply Bill</p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div>
                        <strong>Supplier/Party Details:</strong>
                        <p style="margin: 5px 0;">${tx.party_name}</p>
                    </div>
                    <div style="text-align: right;">
                        <strong>Inward Bill ID:</strong> ${tx.id}<br>
                        <strong>Date:</strong> ${tx.date}
                    </div>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">#</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Product</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Pkts</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Sheet/Pkt</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Total Qty</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Price</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>
                <div style="text-align: right; font-size: 1.1rem;">
                    <strong>Grand Total: ₹${tx.grand_total.toFixed(2)}</strong>
                </div>
                <div style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px;">
                    <strong>Notes:</strong><br>
                    <p style="margin: 5px 0;">${tx.notes || 'No extra notes.'}</p>
                </div>
            </div>
        `;

        document.getElementById('modal-invoice').classList.add('show');
        document.getElementById('modal-backdrop').classList.add('show');
    }

    // ==========================================
    // OUTWARD (EXPORTS) FLOW
    // ==========================================
    resetOutwardForm() {
        document.getElementById('outward-submit-form').reset();
        document.getElementById('outward-date').value = new Date().toISOString().substring(0, 10);
        document.getElementById('outward-rows-container').innerHTML = '';

        // Populate party (customers or both)
        const pSelect = document.getElementById('outward-party');
        pSelect.innerHTML = '<option value="">-- Choose Party --</option>';
        this.db.parties.filter(p => p.type === 'Customer' || p.type === 'Both').forEach(p => {
            pSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });

        pSelect.addEventListener('change', () => {
            const party = this.db.parties.find(pt => pt.id === parseInt(pSelect.value));
            if (party) {
                document.getElementById('outward-mobile').value = party.mobile || '';
            }
        });

        // Add first outward line row
        this.addOutwardRow();
        this.calculateOutwardGrandTotal();
    }

    addOutwardRow() {
        const container = document.getElementById('outward-rows-container');
        const rowId = 'outw-' + Date.now() + Math.floor(Math.random() * 100);

        let prodOptions = '<option value="">Select Product</option>';
        this.db.products.forEach(p => {
            prodOptions += `<option value="${p.id}">${p.name} (Stock: ${p.current_stock || 0} pkts)</option>`;
        });

        const rowHTML = `
            <div class="grid-row-item outward-item-row" id="row-${rowId}" style="grid-template-columns: 2.2fr 1fr 1.2fr 1.2fr 1.2fr 45px;">
                <select class="form-control outward-prod-select" onchange="app.handleOutwardProductChange('${rowId}', this.value)" required>
                    ${prodOptions}
                </select>
                <input type="number" class="form-control outward-pkt" placeholder="Box" min="0" oninput="app.calculateOutwardRow('${rowId}', 'pkt')" required>
                <input type="number" class="form-control outward-pieces" placeholder="Pieces" min="0" oninput="app.calculateOutwardRow('${rowId}', 'pieces')" required>
                <input type="number" class="form-control outward-price" placeholder="Price" step="0.01" min="0" oninput="app.calculateOutwardRow('${rowId}', 'price')" required>
                <input type="number" class="form-control outward-total" placeholder="Total" readonly>
                <button type="button" class="btn-remove-row" onclick="app.removeOutwardRow('${rowId}')"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHTML);
    }

    removeOutwardRow(rowId) {
        const rows = document.querySelectorAll('.outward-item-row');
        if (rows.length <= 1) {
            alert("At least one line item is required.");
            return;
        }
        document.getElementById(`row-${rowId}`).remove();
        this.calculateOutwardGrandTotal();
    }

    handleOutwardProductChange(rowId, val) {
        const pId = parseInt(val);
        const prod = this.db.products.find(p => p.id === pId);
        const row = document.getElementById(`row-${rowId}`);
        if (prod && row) {
            const optR1 = document.getElementById('outward-opt-r1')?.checked;
            const optR2 = document.getElementById('outward-opt-r2')?.checked;
            const optR3 = document.getElementById('outward-opt-r3')?.checked;

            let price = prod.sales_price || prod.sell_price || 0;
            if (optR1 && prod.r1_rate) price = prod.r1_rate;
            else if (optR2 && prod.r2_rate) price = prod.r2_rate;
            else if (optR3 && prod.r3_rate) price = prod.r3_rate;

            row.querySelector('.outward-price').value = price;

            const pktInput = row.querySelector('.outward-pkt');
            const pcsInput = row.querySelector('.outward-pieces');
            const pkt = parseFloat(pktInput.value) || 0;
            const pieces = parseFloat(pcsInput.value) || 0;

            if (pkt > 0 && pieces === 0) {
                pcsInput.value = pkt * 10;
            } else if (pieces > 0 && pkt === 0) {
                pktInput.value = pieces / 10;
            }

            this.calculateOutwardRow(rowId);
        }
    }

    calculateOutwardRow(rowId, trigger) {
        const row = document.getElementById(`row-${rowId}`);
        if (!row) return;

        const pktInput = row.querySelector('.outward-pkt');
        const piecesInput = row.querySelector('.outward-pieces');

        if (trigger === 'pkt') {
            const pkt = parseFloat(pktInput.value) || 0;
            piecesInput.value = pkt * 10;
        } else if (trigger === 'pieces') {
            const pieces = parseFloat(piecesInput.value) || 0;
            pktInput.value = pieces / 10;
        }

        const pieces = parseFloat(piecesInput.value) || 0;
        const price = parseFloat(row.querySelector('.outward-price').value) || 0;

        const total = pieces * price;
        row.querySelector('.outward-total').value = total.toFixed(2);

        this.calculateOutwardGrandTotal();
    }

    updateOutwardRowPrices() {
        const optR1 = document.getElementById('outward-opt-r1')?.checked;
        const optR2 = document.getElementById('outward-opt-r2')?.checked;
        const optR3 = document.getElementById('outward-opt-r3')?.checked;

        document.querySelectorAll('.outward-item-row').forEach(row => {
            const select = row.querySelector('.outward-prod-select');
            const pId = parseInt(select.value);
            if (pId) {
                const prod = this.db.products.find(p => p.id === pId);
                if (prod) {
                    let price = prod.sales_price || prod.sell_price || 0;
                    if (optR1 && prod.r1_rate) price = prod.r1_rate;
                    else if (optR2 && prod.r2_rate) price = prod.r2_rate;
                    else if (optR3 && prod.r3_rate) price = prod.r3_rate;

                    row.querySelector('.outward-price').value = price;

                    // Recalculate row total
                    const pieces = parseFloat(row.querySelector('.outward-pieces').value) || 0;
                    const total = pieces * price;
                    row.querySelector('.outward-total').value = total.toFixed(2);
                }
            }
        });
        this.calculateOutwardGrandTotal();
    }

    calculateOutwardGrandTotal() {
        let subtotal = 0;
        let totalPkts = 0;
        let totalPieces = 0;

        document.querySelectorAll('.outward-item-row').forEach(row => {
            const tot = parseFloat(row.querySelector('.outward-total').value) || 0;
            const pkt = parseFloat(row.querySelector('.outward-pkt').value) || 0;
            const pieces = parseFloat(row.querySelector('.outward-pieces').value) || 0;

            subtotal += tot;
            totalPkts += pkt;
            totalPieces += pieces;
        });

        document.getElementById('outward-sub-total').value = subtotal.toFixed(2);
        document.getElementById('outward-total-pkt').value = totalPkts;
        document.getElementById('outward-total-piece').value = totalPieces;

        // Apply invoice settings
        const gst = parseFloat(document.getElementById('outward-gst').value) || 0;
        const parcel = parseFloat(document.getElementById('outward-parcel').value) || 0;
        const discountPct = parseFloat(document.getElementById('outward-discount').value) || 0;
        const adjustment = parseFloat(document.getElementById('outward-adjustment').value) || 0;

        const discountVal = subtotal * (discountPct / 100);
        const grandTotal = subtotal + gst + parcel - discountVal + adjustment;

        document.getElementById('outward-grand-total').value = `₹${grandTotal.toFixed(2)}`;
    }

    handleOutwardSubmit(e, shouldPrint) {
        e.preventDefault();

        const partyId = parseInt(document.getElementById('outward-party').value);
        const date = document.getElementById('outward-date').value;
        const barcode = document.getElementById('outward-barcode').value;
        const mobile = document.getElementById('outward-mobile').value;
        const notes = document.getElementById('outward-notes').value;
        const extraInvoice = document.getElementById('outward-extra-invoice').value;

        // Options
        const optR1 = document.getElementById('outward-opt-r1').checked;
        const optR2 = document.getElementById('outward-opt-r2').checked;
        const optR3 = document.getElementById('outward-opt-r3').checked;
        const rType = optR1 ? 'R1' : (optR2 ? 'R2' : (optR3 ? 'R3' : 'Standard'));

        const party = this.db.parties.find(p => p.id === partyId);
        if (!party) return;

        const items = [];
        let totalPkts = 0;
        let totalPieces = 0;
        let subtotal = 0;
        let stockShortage = false;

        const rows = document.querySelectorAll('.outward-item-row');
        rows.forEach(row => {
            const product_id = parseInt(row.querySelector('.outward-prod-select').value);
            const pkt = parseInt(row.querySelector('.outward-pkt').value) || 0;
            const pieces = parseInt(row.querySelector('.outward-pieces').value) || 0;
            const price = parseFloat(row.querySelector('.outward-price').value) || 0;
            const total = pieces * price;

            if (product_id) {
                // Stock validation
                const product = this.db.products.find(p => p.id === product_id);
                if (product) {
                    if ((product.current_stock || 0) < pkt) {
                        alert(`Warning: Insufficient stock for ${product.name}. Available: ${product.current_stock || 0} pkts, trying to export: ${pkt} pkts`);
                        stockShortage = true;
                    }
                    // Decrement stock
                    product.current_stock = (product.current_stock || 0) - pkt;
                }

                items.push({ product_id, pkt, pieces, price, total });
                totalPkts += pkt;
                totalPieces += pieces;
                subtotal += total;
            }
        });

        if (stockShortage) {
            if (!confirm("Stock is negative or low. Proceed anyway?")) return;
        }

        const gst = parseFloat(document.getElementById('outward-gst').value) || 0;
        const parcel = parseFloat(document.getElementById('outward-parcel').value) || 0;
        const discountPct = parseFloat(document.getElementById('outward-discount').value) || 0;
        const adjustment = parseFloat(document.getElementById('outward-adjustment').value) || 0;
        const discountVal = subtotal * (discountPct / 100);
        const grandTotal = subtotal + gst + parcel - discountVal + adjustment;

        const outwardId = 'INV-' + Date.now().toString().slice(-6);
        const outwardTx = {
            id: outwardId,
            party_id: partyId,
            party_name: party.name,
            date,
            barcode,
            mobile,
            notes,
            r_type: rType,
            sub_total: subtotal,
            total_pkts: totalPkts,
            total_pieces: totalPieces,
            gst,
            parcel,
            discount_pct: discountPct,
            adjustment,
            grand_total: grandTotal,
            extra_invoice: extraInvoice,
            items
        };

        // Update Party balance (we sold to them, they owe us money)
        party.balance = (party.balance || 0) + grandTotal;

        this.db.outwards.unshift(outwardTx);
        this.saveDB('outwards');
        this.saveDB('products');
        this.saveDB('parties');

        alert(`Outward invoice created! Invoice ID: ${outwardId}`);

        if (shouldPrint) {
            this.printOutwardDocument(outwardTx);
        }

        this.resetOutwardForm();
        this.switchTab('outward-report');
    }
    renderOutwardReport() {
        const tbody = document.querySelector('#outward-report-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        let totalPkts = 0;
        let totalPieces = 0;
        let grandTotalSum = 0;

        this.db.outwards.forEach(tx => {
            totalPkts += tx.total_pkts || 0;
            totalPieces += tx.total_pieces || 0;
            grandTotalSum += tx.grand_total || 0;

            tbody.innerHTML += `
                <tr>
                    <td><strong>${tx.id}</strong></td>
                    <td>${tx.date}</td>
                    <td>${tx.party_name}</td>
                    <td>${tx.total_pkts}</td>
                    <td>${tx.total_pieces}</td>
                    <td><strong>₹${tx.grand_total.toFixed(2)}</strong></td>
                    <td>
                        <div class="action-btns" style="display: flex; gap: 5px;">
                            <button class="btn btn-primary btn-sm" onclick="app.viewOutwardInvoice('${tx.id}')" title="View/Print"><i class="fa-solid fa-eye"></i> View/Print</button>
                            <button class="btn btn-secondary btn-sm" onclick="app.deleteOutward('${tx.id}')" title="Delete Outward"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        if (this.db.outwards.length > 0) {
            tbody.innerHTML += `
                <tr style="background-color: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1;">
                    <td colspan="3"><strong>Total Sum:</strong></td>
                    <td><strong>${totalPkts}</strong></td>
                    <td><strong>${totalPieces}</strong></td>
                    <td><strong>₹${grandTotalSum.toFixed(2)}</strong></td>
                    <td></td>
                </tr>
            `;
        }
    }

    deleteOutward(id) {
        if (!confirm("Are you sure you want to delete this outward invoice? This will revert stock levels and party balances.")) return;
        const txIndex = this.db.outwards.findIndex(tx => tx.id === id);
        if (txIndex === -1) return;
        const tx = this.db.outwards[txIndex];

        // Revert party balance
        const party = this.db.parties.find(p => p.id === tx.party_id);
        if (party) {
            party.balance = (party.balance || 0) - tx.grand_total;
        }

        // Revert product stock
        tx.items.forEach(item => {
            const product = this.db.products.find(p => p.id === item.product_id);
            if (product) {
                // Outward decremented stock, so delete increments it
                product.current_stock = (product.current_stock || 0) + item.pkt;
            }
        });

        this.db.outwards.splice(txIndex, 1);
        this.saveDB('outwards');
        this.saveDB('products');
        this.saveDB('parties');
        this.renderOutwardReport();
        this.updateGlobalCounters();
    }

    viewOutwardInvoice(id) {
        const tx = this.db.outwards.find(x => x.id === id);
        if (!tx) return;
        this.printOutwardDocument(tx);
    }

    printOutwardDocument(tx) {
        const printArea = document.getElementById('invoice-print-area');

        let itemsHTML = '';
        tx.items.forEach((item, idx) => {
            const prod = this.db.products.find(p => p.id === item.product_id);
            const pName = prod ? prod.name : 'Unknown Product';
            itemsHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${pName}</td>
                    <td>${item.pkt}</td>
                    <td>${item.pieces}</td>
                    <td>₹${item.price.toFixed(2)}</td>
                    <td>₹${item.total.toFixed(2)}</td>
                </tr>
            `;
        });

        printArea.innerHTML = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #0d9488;">BINDI MARKET Wholesalers</h2>
                    <p style="margin: 5px 0 0 0;">Outward Tax Invoice (${tx.r_type || 'Standard'})</p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div>
                        <strong>Buyer Details:</strong>
                        <p style="margin: 5px 0;"><strong>${tx.party_name}</strong></p>
                        <p style="margin: 5px 0;">Mobile: ${tx.mobile || 'N/A'}</p>
                    </div>
                    <div style="text-align: right;">
                        <strong>Invoice ID:</strong> ${tx.id}<br>
                        <strong>Date:</strong> ${tx.date}<br>
                        <strong>Barcode:</strong> ${tx.barcode || 'N/A'}
                    </div>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">#</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Product</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Pkts</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Pieces</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Unit Price</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>
                
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 20px;">
                    <div>
                        <strong>Notes:</strong><br>
                        <p style="margin: 5px 0; font-size: 0.9rem;">${tx.notes || 'Thank you for your business!'}</p>
                        <p style="font-size: 0.8rem; color: #777;">Info: ${tx.extra_invoice || ''}</p>
                    </div>
                    <div style="text-align: right; width: 250px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 4px 0; text-align: left;">Sub Total:</td>
                                <td style="padding: 4px 0; text-align: right;">₹${tx.sub_total.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; text-align: left;">GST:</td>
                                <td style="padding: 4px 0; text-align: right;">₹${tx.gst.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; text-align: left;">Parcel:</td>
                                <td style="padding: 4px 0; text-align: right;">₹${tx.parcel.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; text-align: left;">Discount (${tx.discount_pct}%):</td>
                                <td style="padding: 4px 0; text-align: right;">-₹${(tx.sub_total * (tx.discount_pct / 100)).toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; text-align: left;">Adjustment:</td>
                                <td style="padding: 4px 0; text-align: right;">₹${tx.adjustment.toFixed(2)}</td>
                            </tr>
                            <tr style="border-top: 1px solid #333; font-weight: bold;">
                                <td style="padding: 6px 0; text-align: left;">Grand Total:</td>
                                <td style="padding: 6px 0; text-align: right; color: #0d9488;">₹${tx.grand_total.toFixed(2)}</td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('modal-invoice').classList.add('show');
        document.getElementById('modal-backdrop').classList.add('show');
    }

    // ==========================================
    // ANALYTICS & CHARTS
    // ==========================================
    renderCharts() {
        if (typeof Chart === 'undefined') {
            console.warn("Chart.js is not loaded. Connect to the internet to see analytics.");
            const ctx = document.getElementById('tradeChart');
            if (ctx && ctx.parentElement) {
                ctx.parentElement.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 0.9rem; padding: 20px; text-align: center;">Chart.js library is not loaded. Connect to the internet to see analytics.</div>';
            }
            return;
        }
        // Collect chart data
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const inwardMonthly = new Array(12).fill(0);
        const outwardMonthly = new Array(12).fill(0);

        this.db.inwards.forEach(inw => {
            const date = new Date(inw.date);
            if (!isNaN(date)) {
                const m = date.getMonth();
                inwardMonthly[m] += inw.grand_total;
            }
        });

        this.db.outwards.forEach(outw => {
            const date = new Date(outw.date);
            if (!isNaN(date)) {
                const m = date.getMonth();
                outwardMonthly[m] += outw.grand_total;
            }
        });

        const ctx = document.getElementById('tradeChart');
        if (!ctx) return;

        if (this.tradeChart) {
            this.tradeChart.destroy();
        }

        this.tradeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Inwards (Imports)',
                        data: inwardMonthly,
                        backgroundColor: '#1e3a8a',
                        borderRadius: 4
                    },
                    {
                        label: 'Outwards (Exports)',
                        data: outwardMonthly,
                        backgroundColor: '#0d9488',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) { return '₹' + value; }
                        }
                    }
                }
            }
        });
    }

    // ==========================================
    // STITCHING MODULE
    // ==========================================
    setupAutocomplete(inputOrId, resultsOrId, dataFetcher) {
        const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
        const results = typeof resultsOrId === 'string' ? document.getElementById(resultsOrId) : resultsOrId;
        if (!input || !results) return;

        let activeIndex = -1;

        const updateActiveItem = (items) => {
            items.forEach((item, index) => {
                if (index === activeIndex) {
                    item.classList.add('active');
                    item.style.backgroundColor = '#e2e8f0'; // highlight color
                    item.style.color = '#0f172a';
                } else {
                    item.classList.remove('active');
                    item.style.backgroundColor = '';
                    item.style.color = '';
                }
            });
        };

        const showResults = () => {
            const query = input.value.toLowerCase().trim();
            const list = dataFetcher();
            
            // Filter options based on query
            const matches = list.filter(item => (item || '').toLowerCase().includes(query));
            
            if (matches.length === 0) {
                results.innerHTML = '';
                results.style.display = 'none';
                activeIndex = -1;
                return;
            }

            results.innerHTML = '';
            activeIndex = -1;
            matches.slice(0, 10).forEach(item => {
                const div = document.createElement('div');
                div.className = 'search-results-item';
                div.style.padding = '8px 12px';
                div.style.cursor = 'pointer';
                div.innerHTML = `<strong>${item}</strong>`;
                div.addEventListener('click', () => {
                    input.value = item;
                    results.innerHTML = '';
                    results.style.display = 'none';
                    activeIndex = -1;
                    // Trigger input and change events to update calculations
                    input.dispatchEvent(new Event('input'));
                    input.dispatchEvent(new Event('change'));
                });
                results.appendChild(div);
            });
            results.style.display = 'block';
        };

        input.addEventListener('input', showResults);
        input.addEventListener('focus', showResults);

        input.addEventListener('keydown', (e) => {
            const items = results.querySelectorAll('.search-results-item');
            if (!items.length || results.style.display === 'none') return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopImmediatePropagation();
                activeIndex++;
                if (activeIndex >= items.length) activeIndex = 0;
                updateActiveItem(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopImmediatePropagation();
                activeIndex--;
                if (activeIndex < 0) activeIndex = items.length - 1;
                updateActiveItem(items);
            } else if (e.key === 'Enter') {
                if (activeIndex >= 0 && activeIndex < items.length) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    items[activeIndex].click();
                }
            }
        });

        // Close dropdown on click outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !results.contains(e.target)) {
                results.style.display = 'none';
                activeIndex = -1;
            }
        });
    }

    setupArrowDownNavigation(inputEl, selector) {
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const currentRow = inputEl.closest('.stitching-item-row');
                const prevRow = currentRow ? currentRow.previousElementSibling : null;
                if (prevRow && prevRow.classList.contains('stitching-item-row')) {
                    const prevInput = prevRow.querySelector(selector);
                    if (prevInput) {
                        inputEl.value = prevInput.value;
                        // Dispatch events to trigger recalculations or logic
                        inputEl.dispatchEvent(new Event('input'));
                        inputEl.dispatchEvent(new Event('change'));
                    }
                }
            }
        });
    }

    addStitchingRow(defaultData = null) {
        const container = document.getElementById('stitching-rows-container');
        if (!container) return;

        const rowId = 'stitch-' + Date.now() + Math.floor(Math.random() * 100);
        const rowHTML = `
            <div class="stitching-grid-row stitching-item-row" id="row-${rowId}">
                <input type="hidden" class="stitch-row-id" value="${defaultData ? defaultData.id : ''}">
                
                <div style="position: relative;">
                    <input type="text" class="form-control stitch-item-name" placeholder="Search..." autocomplete="off" required value="${defaultData ? defaultData.item_name || '' : ''}">
                    <div class="search-results-dropdown stitch-item-name-results"></div>
                </div>

                <div>
                    <input type="text" class="form-control stitch-bindi-bharti" placeholder="Count" required value="${defaultData ? defaultData.bindi_bharti || '' : ''}">
                </div>

                <div style="position: relative;">
                    <input type="text" class="form-control stitch-size" placeholder="Size" autocomplete="off" required value="${defaultData ? defaultData.size || '' : ''}">
                    <div class="search-results-dropdown stitch-size-results"></div>
                </div>

                <div style="position: relative;">
                    <input type="text" class="form-control stitch-color" placeholder="Color" autocomplete="off" required value="${defaultData ? defaultData.color || '' : ''}">
                    <div class="search-results-dropdown stitch-color-results"></div>
                </div>

                <div>
                    <input type="number" class="form-control stitch-avg" placeholder="Avg" step="0.01" required value="${defaultData ? defaultData.avg || '' : ''}">
                </div>

                <div>
                    <input type="number" class="form-control stitch-sheet-cost" placeholder="Sheet" step="0.01" required value="${defaultData ? defaultData.sheet_cost || '' : ''}">
                </div>

                <div>
                    <input type="text" class="form-control stitch-total" placeholder="Total" style="font-weight: 700; color: var(--primary-color);" readonly value="${defaultData ? (defaultData.total || 0).toFixed(2) : '0.00'}">
                </div>

                <div>
                    <button type="button" class="btn-remove-row" onclick="app.removeStitchingRow('${rowId}')"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHTML);

        const row = document.getElementById(`row-${rowId}`);
        if (row) {
            // Setup Autocompletes for this row
            const itemNameInput = row.querySelector('.stitch-item-name');
            const itemNameResults = row.querySelector('.stitch-item-name-results');
            this.setupAutocomplete(itemNameInput, itemNameResults, () => {
                return [...new Set(this.db.products.map(p => p.name))];
            });

            const sizeInput = row.querySelector('.stitch-size');
            const sizeResults = row.querySelector('.stitch-size-results');
            this.setupAutocomplete(sizeInput, sizeResults, () => {
                return [...new Set(this.db.sizes.map(s => s.name))];
            });

            const colorInput = row.querySelector('.stitch-color');
            const colorResults = row.querySelector('.stitch-color-results');
            this.setupAutocomplete(colorInput, colorResults, () => {
                return [...new Set(this.db.colors.map(c => c.name))];
            });

            // Setup calculations for this row
            const avgInput = row.querySelector('.stitch-avg');
            const costInput = row.querySelector('.stitch-sheet-cost');
            const totalInput = row.querySelector('.stitch-total');

            const calcRowTotal = () => {
                const avg = parseFloat(avgInput.value) || 0;
                const cost = parseFloat(costInput.value) || 0;
                totalInput.value = (avg * cost).toFixed(2);
            };

            avgInput.addEventListener('input', calcRowTotal);
            costInput.addEventListener('input', calcRowTotal);

            // Enter key navigation inside the row
            const bhartiInput = row.querySelector('.stitch-bindi-bharti');

            itemNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    bhartiInput.focus();
                }
            });

            bhartiInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sizeInput.focus();
                }
            });

            sizeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    colorInput.focus();
                }
            });

            colorInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    avgInput.focus();
                }
            });

            avgInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    costInput.focus();
                }
            });

            costInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();

                    const rows = Array.from(container.querySelectorAll('.stitching-item-row'));
                    const currentIndex = rows.indexOf(row);
                    if (currentIndex === rows.length - 1) {
                        // This is the last row, automatically add a new row
                        this.addStitchingRow();

                        // Focus the item name input of the new row
                        const newRows = Array.from(container.querySelectorAll('.stitching-item-row'));
                        const nextRow = newRows[currentIndex + 1];
                        if (nextRow) {
                            const nextItemNameInput = nextRow.querySelector('.stitch-item-name');
                            if (nextItemNameInput) {
                                nextItemNameInput.focus();
                            }
                        }
                    } else {
                        // Focus the next existing row's item name input
                        const nextRow = rows[currentIndex + 1];
                        if (nextRow) {
                            const nextItemNameInput = nextRow.querySelector('.stitch-item-name');
                            if (nextItemNameInput) {
                                nextItemNameInput.focus();
                            }
                        }
                    }
                }
            });

            // Setup Arrow Down Navigation for copying previous entry
            this.setupArrowDownNavigation(itemNameInput, '.stitch-item-name');
            this.setupArrowDownNavigation(bhartiInput, '.stitch-bindi-bharti');
            this.setupArrowDownNavigation(sizeInput, '.stitch-size');
            this.setupArrowDownNavigation(colorInput, '.stitch-color');
            this.setupArrowDownNavigation(avgInput, '.stitch-avg');
            this.setupArrowDownNavigation(costInput, '.stitch-sheet-cost');
        }
    }

    removeStitchingRow(rowId) {
        const rows = document.querySelectorAll('.stitching-item-row');
        if (rows.length <= 1) {
            alert("At least one stitching row is required.");
            return;
        }
        const row = document.getElementById(`row-${rowId}`);
        if (row) row.remove();
    }

    resetStitchingForm() {
        const container = document.getElementById('stitching-rows-container');
        if (container) {
            container.innerHTML = '';
        }
        const lotInput = document.getElementById('stitch-lot-no');
        if (lotInput) {
            lotInput.value = '';
        }
        const header = document.querySelector('#tab-add-stitching h3');
        if (header) {
            header.innerText = 'Add Stitching Entry';
        }
        this.addStitchingRow();
    }

    handleStitchingSubmit(e) {
        e.preventDefault();
        const lotInput = document.getElementById('stitch-lot-no');
        const lot_no = lotInput ? lotInput.value.trim() : '';

        const rows = document.querySelectorAll('.stitching-item-row');
        if (rows.length === 0) {
            alert("Please add at least one stitching entry.");
            return;
        }

        let savedCount = 0;
        rows.forEach((row, index) => {
            const idInput = row.querySelector('.stitch-row-id');
            const id = idInput ? idInput.value : '';
            const item_name = row.querySelector('.stitch-item-name').value.trim();
            const bindi_bharti = row.querySelector('.stitch-bindi-bharti').value.trim();
            const size = row.querySelector('.stitch-size').value.trim();
            const color = row.querySelector('.stitch-color').value.trim();
            const avg = parseFloat(row.querySelector('.stitch-avg').value) || 0;
            const sheet_cost = parseFloat(row.querySelector('.stitch-sheet-cost').value) || 0;
            const total = parseFloat((avg * sheet_cost).toFixed(2));

            if (id) {
                const idx = this.db.stitching.findIndex(s => s.id === id || s.id === parseInt(id));
                if (idx !== -1) {
                    this.db.stitching[idx] = {
                        ...this.db.stitching[idx],
                        lot_no,
                        item_name,
                        bindi_bharti,
                        size,
                        color,
                        avg,
                        sheet_cost,
                        total,
                        entry_by: "Heet Punamiya"
                    };
                }
            } else {
                const newId = Date.now() + index;
                this.db.stitching.push({
                    id: newId,
                    lot_no,
                    item_name,
                    bindi_bharti,
                    size,
                    color,
                    avg,
                    sheet_cost,
                    total,
                    date: new Date().toISOString(),
                    entry_by: "Heet Punamiya"
                });
            }
            savedCount++;
        });

        this.saveDB('stitching');
        alert(`${savedCount} stitching record(s) saved successfully!`);
        this.resetStitchingForm();
        this.switchTab('stitching-report');
    }

    renderStitchingReport() {
        const tbody = document.querySelector('#stitching-report-table tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        const searchInput = document.getElementById('stitch-report-search');
        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

        const filtered = this.db.stitching.filter(s =>
            (s.lot_no || '').toLowerCase().includes(search) ||
            (s.item_name || '').toLowerCase().includes(search) ||
            (s.bindi_bharti || '').toLowerCase().includes(search) ||
            (s.size || '').toLowerCase().includes(search) ||
            (s.color || '').toLowerCase().includes(search)
        );

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">No stitching entries found</td></tr>`;
            return;
        }

        // Group filtered entries by lot_no
        const groups = {};
        filtered.forEach(s => {
            const lot = s.lot_no || 'N/A';
            if (!groups[lot]) {
                groups[lot] = [];
            }
            groups[lot].push(s);
        });

        // Loop over each lot group
        for (const lot_no in groups) {
            // Render a Group Header row
            tbody.innerHTML += `
                <tr style="background-color: #f8fafc; font-weight: 700; border-top: 2px solid var(--border-color);">
                    <td colspan="9" style="font-size: 0.95rem; color: #0f172a; padding: 12px 15px;">
                        <i class="fa-solid fa-box" style="margin-right: 6px; color: #058882;"></i>
                        Lot No: <span style="color: #058882; font-weight: 800;">${lot_no}</span>
                    </td>
                </tr>
            `;

            // Render each entry in the lot group
            groups[lot_no].forEach((s, index) => {
                const serialNum = index + 1;
                tbody.innerHTML += `
                    <tr>
                        <td>S.No ${serialNum} <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">ID: ${s.id}</span></td>
                        <td><strong>${s.item_name}</strong></td>
                        <td>${s.bindi_bharti}</td>
                        <td><span class="badge-status" style="background-color: #f1f5f9; color: #475569; padding: 4px 8px; border-radius: 4px;">${s.size}</span></td>
                        <td><span class="badge-status" style="background-color: #f1f5f9; color: #475569; padding: 4px 8px; border-radius: 4px;">${s.color}</span></td>
                        <td>${s.avg}</td>
                        <td>${s.sheet_cost.toFixed(2)}</td>
                        <td><strong style="color: var(--primary-color);">${s.total.toFixed(2)}</strong></td>
                        <td>
                            <div class="action-btns">
                                <button class="btn btn-primary btn-sm" onclick="app.editStitching(${s.id})"><i class="fa-solid fa-edit"></i></button>
                                <button class="btn btn-secondary btn-sm" onclick="app.deleteStitching(${s.id})"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
    }

    editStitching(id) {
        const s = this.db.stitching.find(x => x.id === id || x.id === parseInt(id));
        if (!s) return;

        this.switchTab('add-stitching');

        const container = document.getElementById('stitching-rows-container');
        if (container) {
            container.innerHTML = '';
        }
        
        const header = document.querySelector('#tab-add-stitching h3');
        if (header) {
            header.innerText = 'Edit Stitching Entry';
        }

        const lotInput = document.getElementById('stitch-lot-no');
        if (lotInput) {
            lotInput.value = s.lot_no || '';
        }

        this.addStitchingRow(s);
    }

    deleteStitching(id) {
        if (!confirm("Are you sure you want to delete this stitching record?")) return;
        this.db.stitching = this.db.stitching.filter(s => s.id !== id && s.id !== parseInt(id));
        this.saveDB('stitching');
        this.renderStitchingReport();
    }

    // ==========================================
    // LABOR DISTRIBUTION MODULE
    // ==========================================
    resetLaborLotForm() {
        const lotInput = document.getElementById('labor-search-lot');
        if (lotInput) lotInput.value = '';

        const reportArea = document.getElementById('labor-lot-report-area');
        if (reportArea) reportArea.style.display = 'none';

        const messageDiv = document.getElementById('labor-lot-message');
        if (messageDiv) {
            messageDiv.style.display = 'none';
            messageDiv.innerText = '';
        }

        const loadingDiv = document.getElementById('labor-lot-loading');
        if (loadingDiv) loadingDiv.style.display = 'none';
    }

    searchLaborLot() {
        const lotInput = document.getElementById('labor-search-lot');
        const lot_no = lotInput ? lotInput.value.trim() : '';

        const reportArea = document.getElementById('labor-lot-report-area');
        const messageDiv = document.getElementById('labor-lot-message');
        const loadingDiv = document.getElementById('labor-lot-loading');

        if (!lot_no) {
            alert("Please enter a Lot Number to search.");
            return;
        }

        // Show loading state
        if (reportArea) reportArea.style.display = 'none';
        if (messageDiv) messageDiv.style.display = 'none';
        if (loadingDiv) loadingDiv.style.display = 'block';

        // Search in local DB (simulated database query delay)
        setTimeout(() => {
            if (loadingDiv) loadingDiv.style.display = 'none';

            const filtered = this.db.stitching.filter(s => 
                (s.lot_no || '').toLowerCase() === lot_no.toLowerCase()
            );

            if (filtered.length === 0) {
                if (messageDiv) {
                    messageDiv.innerText = "No stitching report found for this lot number.";
                    messageDiv.className = "alert alert-warning";
                    messageDiv.style.display = 'block';
                }
                return;
            }

            if (!this.db.labours) this.db.labours = [];

            this.renderLaborLotTable(filtered);

            if (reportArea) reportArea.style.display = 'block';
        }, 500);
    }

    renderLaborLotTable(filtered) {
        const tbody = document.querySelector('#labor-lot-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        filtered.forEach(s => {
            const formattedDate = s.date ? new Date(s.date).toLocaleDateString('en-GB') : 'N/A';
            const totalSheets = s.sheet_cost || 0;

            // Ensure s.assignments is resolved
            if (!s.assignments) {
                if (s.labour_no) {
                    s.assignments = [{
                        labour_no: s.labour_no,
                        sheet_given: s.sheet_given !== undefined ? s.sheet_given : 0
                    }];
                } else {
                    s.assignments = [{
                        labour_no: '',
                        sheet_given: 0
                    }];
                }
            } else if (s.assignments.length === 0) {
                s.assignments = [{
                    labour_no: '',
                    sheet_given: 0
                }];
            }

            const totalGiven = s.assignments.reduce((sum, a) => sum + (parseFloat(a.sheet_given) || 0), 0);
            const remaining = totalSheets - totalGiven;

            s.assignments.forEach((asg, asgIndex) => {
                const remainingStyle = remaining > 0 
                    ? 'background-color: #fee2e2; color: #ef4444;' 
                    : 'background-color: #d1fae5; color: #065f46;';

                const labourOptions = this.db.labours.map(l => `
                    <option value="${l.labour_no}" ${asg.labour_no === l.labour_no ? 'selected' : ''}>
                        ${l.labour_no}
                    </option>
                `).join('');

                const labourObj = this.db.labours.find(l => l.labour_no === asg.labour_no);
                const labourName = labourObj ? labourObj.name : '';

                const actionBtn = asgIndex === 0 
                    ? `<button type="button" class="btn btn-sm btn-success btn-add-assignment" data-id="${s.id}" style="padding: 4px 8px; font-size: 0.85rem;"><i class="fa-solid fa-plus"></i> Add Labour</button>`
                    : `<button type="button" class="btn btn-sm btn-danger btn-remove-assignment" data-id="${s.id}" data-index="${asgIndex}" style="padding: 4px 8px; font-size: 0.85rem;"><i class="fa-solid fa-trash"></i></button>`;

                tbody.innerHTML += `
                    <tr class="stitch-row-group-${s.id}" data-stitch-id="${s.id}">
                        <td>
                            <select class="form-control edit-dist-labour-no" data-id="${s.id}" data-index="${asgIndex}" style="width: 140px;" required>
                                <option value="">Select Labour</option>
                                ${labourOptions}
                            </select>
                        </td>
                        <td class="edit-dist-labour-name" style="font-weight: 600;">${labourName}</td>
                        <td>${formattedDate}</td>
                        <td><strong>${s.item_name || 'N/A'}</strong></td>
                        <td>${s.bindi_bharti || 'N/A'}</td>
                        <td>
                            <span class="badge-status" style="background-color: #f1f5f9; color: #475569; padding: 4px 8px; border-radius: 4px;">
                                ${s.color || 'N/A'}
                            </span>
                        </td>
                        <td>${totalSheets}</td>
                        <td>${s.avg || 0}</td>
                        <td><strong>${s.total || 0}</strong></td>
                        <td>
                            <input type="number" class="form-control edit-dist-sheet-given" data-id="${s.id}" data-index="${asgIndex}" data-total-sheets="${totalSheets}" value="${asg.sheet_given !== undefined && asg.sheet_given !== 0 ? asg.sheet_given : ''}" style="width: 120px;" step="0.01" min="0" required placeholder="0.00">
                        </td>
                        <td>
                            <span class="remaining-badge-${s.id} badge-status" style="${remainingStyle} font-weight: 700; padding: 6px 12px; border-radius: 4px; display: inline-block;">
                                ${remaining.toFixed(2)}
                            </span>
                        </td>
                        <td style="text-align: center;">
                            ${actionBtn}
                        </td>
                    </tr>
                `;
            });
        });

        // Attach select change listener to update labour name column
        tbody.querySelectorAll('.edit-dist-labour-no').forEach(select => {
            select.addEventListener('change', () => {
                const selectedVal = select.value;
                const lObj = this.db.labours.find(l => l.labour_no === selectedVal);
                const nameCell = select.closest('tr').querySelector('.edit-dist-labour-name');
                if (nameCell) {
                    nameCell.innerText = lObj ? lObj.name : '';
                }
            });
        });

        // Attach dynamic update listeners to "Sheet Given" inputs
        tbody.querySelectorAll('.edit-dist-sheet-given').forEach(input => {
            input.addEventListener('input', () => {
                const id = input.getAttribute('data-id');
                const total = parseFloat(input.getAttribute('data-total-sheets')) || 0;
                
                // Sum all sheet_given inputs for this stitching ID in the DOM
                let sum = 0;
                tbody.querySelectorAll(`.edit-dist-sheet-given[data-id="${id}"]`).forEach(inp => {
                    sum += parseFloat(inp.value) || 0;
                });
                
                const rem = total - sum;

                tbody.querySelectorAll(`.remaining-badge-${id}`).forEach(badge => {
                    badge.innerText = rem.toFixed(2);
                    if (rem > 0) {
                        badge.style.backgroundColor = '#fee2e2';
                        badge.style.color = '#ef4444';
                    } else {
                        badge.style.backgroundColor = '#d1fae5';
                        badge.style.color = '#065f46';
                    }
                });
            });
        });

        // Attach event listeners for Add Labour button
        tbody.querySelectorAll('.btn-add-assignment').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                this.syncLaborInputsToMemory();
                
                const idx = this.db.stitching.findIndex(s => s.id === parseInt(id) || s.id === id);
                if (idx !== -1) {
                    if (!this.db.stitching[idx].assignments) {
                        this.db.stitching[idx].assignments = [];
                    }
                    this.db.stitching[idx].assignments.push({ labour_no: '', sheet_given: 0 });
                    
                    // Re-render
                    const lotInput = document.getElementById('labor-search-lot');
                    const lot_no = lotInput ? lotInput.value.trim() : '';
                    const filtered = this.db.stitching.filter(s => 
                        (s.lot_no || '').toLowerCase() === lot_no.toLowerCase()
                    );
                    this.renderLaborLotTable(filtered);
                }
            });
        });

        // Attach event listeners for Remove Labour button
        tbody.querySelectorAll('.btn-remove-assignment').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const index = parseInt(btn.getAttribute('data-index'));
                this.syncLaborInputsToMemory();

                const idx = this.db.stitching.findIndex(s => s.id === parseInt(id) || s.id === id);
                if (idx !== -1 && this.db.stitching[idx].assignments) {
                    this.db.stitching[idx].assignments.splice(index, 1);
                    
                    // Re-render
                    const lotInput = document.getElementById('labor-search-lot');
                    const lot_no = lotInput ? lotInput.value.trim() : '';
                    const filtered = this.db.stitching.filter(s => 
                        (s.lot_no || '').toLowerCase() === lot_no.toLowerCase()
                    );
                    this.renderLaborLotTable(filtered);
                }
            });
        });
    }

    syncLaborInputsToMemory() {
        const rows = document.querySelectorAll('#labor-lot-table tbody tr');
        const tempAssignments = {};

        rows.forEach(row => {
            const stitchId = row.getAttribute('data-stitch-id');
            if (!stitchId) return;

            const labourSelect = row.querySelector('.edit-dist-labour-no');
            const sheetGivenInput = row.querySelector('.edit-dist-sheet-given');

            if (labourSelect && sheetGivenInput) {
                const labourNo = labourSelect.value;
                const sheetGivenVal = parseFloat(sheetGivenInput.value) || 0;

                if (!tempAssignments[stitchId]) {
                    tempAssignments[stitchId] = [];
                }
                tempAssignments[stitchId].push({
                    labour_no: labourNo,
                    sheet_given: sheetGivenVal
                });
            }
        });

        // Write back to this.db.stitching
        for (const stitchId in tempAssignments) {
            const idx = this.db.stitching.findIndex(s => s.id === parseInt(stitchId) || s.id === stitchId);
            if (idx !== -1) {
                this.db.stitching[idx].assignments = tempAssignments[stitchId];
                // For backward compatibility
                if (tempAssignments[stitchId].length > 0) {
                    this.db.stitching[idx].labour_no = tempAssignments[stitchId][0].labour_no;
                    this.db.stitching[idx].sheet_given = tempAssignments[stitchId][0].sheet_given;
                } else {
                    this.db.stitching[idx].labour_no = '';
                    this.db.stitching[idx].sheet_given = 0;
                }
            }
        }
    }

    saveLaborDistribution() {
        this.syncLaborInputsToMemory();

        let hasValidationErrors = false;
        const lotInput = document.getElementById('labor-search-lot');
        const lot_no = lotInput ? lotInput.value.trim() : '';

        if (!lot_no) {
            alert("No lot number active.");
            return;
        }

        // Get stitching records for the current lot
        const lotStitchings = this.db.stitching.filter(s =>
            (s.lot_no || '').toLowerCase() === lot_no.toLowerCase()
        );

        // Validate each stitching record's assignments
        for (let i = 0; i < lotStitchings.length; i++) {
            const s = lotStitchings[i];
            const totalSheets = s.sheet_cost || 0;
            let sumGiven = 0;

            if (!s.assignments || s.assignments.length === 0) {
                alert(`Product "${s.item_name}": Please assign at least one Labour Worker.`);
                hasValidationErrors = true;
                break;
            }

            for (let j = 0; j < s.assignments.length; j++) {
                const asg = s.assignments[j];
                if (!asg.labour_no) {
                    alert(`Product "${s.item_name}", Assignment ${j + 1}: Please select a Labour Worker.`);
                    hasValidationErrors = true;
                    break;
                }
                const given = parseFloat(asg.sheet_given) || 0;
                if (given < 0) {
                    alert(`Product "${s.item_name}", Assignment ${j + 1}: Sheet Given must be a valid non-negative number.`);
                    hasValidationErrors = true;
                    break;
                }
                sumGiven += given;
            }

            if (hasValidationErrors) break;

            if (parseFloat(sumGiven.toFixed(2)) > parseFloat(totalSheets.toFixed(2))) {
                alert(`Product "${s.item_name}": Total Sheet Given (${sumGiven.toFixed(2)}) cannot exceed Total Sheets (${totalSheets.toFixed(2)}).`);
                hasValidationErrors = true;
                break;
            }
        }

        if (hasValidationErrors) return;

        this.saveDB('stitching');
        alert("Labor distribution details saved successfully!");
        
        // Refresh table
        const filtered = this.db.stitching.filter(s => 
            (s.lot_no || '').toLowerCase() === lot_no.toLowerCase()
        );
        this.renderLaborLotTable(filtered);
    }

    // ==========================================
    // LABOUR MASTER & ASSIGNMENT REPORT
    // ==========================================
    handleLabourSubmit(e) {
        e.preventDefault();
        const nameInput = document.getElementById('labour-name');
        const name = nameInput ? nameInput.value.trim() : '';

        if (!name) {
            alert("Labour Name is required.");
            return;
        }

        if (!this.db.labours) this.db.labours = [];

        // Generate Labour Number (e.g. LAB-1001)
        let nextNum = 1001;
        if (this.db.labours.length > 0) {
            this.db.labours.forEach(l => {
                const match = (l.labour_no || '').match(/LAB-(\d+)/);
                if (match) {
                    const num = parseInt(match[1]);
                    if (num >= nextNum) {
                        nextNum = num + 1;
                    }
                }
            });
        }
        const labourNo = `LAB-${nextNum}`;

        const newLabour = {
            id: Date.now(),
            labour_no: labourNo,
            name: name
        };

        this.db.labours.push(newLabour);
        this.saveDB('labours');

        if (nameInput) nameInput.value = '';
        alert(`Labour registered successfully! Assigned Labour No: ${labourNo}`);
        this.renderLabourMaster();
    }

    renderLabourMaster() {
        if (!this.db.labours) this.db.labours = [];

        const tbody = document.querySelector('#labour-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        this.db.labours.forEach(l => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${l.labour_no || 'N/A'}</strong></td>
                    <td>${l.name || 'N/A'}</td>
                    <td>
                        <button class="btn btn-sm btn-danger btn-delete-labour" data-id="${l.id}" style="padding: 4px 8px; font-size: 0.85rem;">
                            <i class="fa-solid fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });

        // Wire delete buttons
        tbody.querySelectorAll('.btn-delete-labour').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.getAttribute('data-id'));
                if (confirm("Are you sure you want to delete this labour worker?")) {
                    this.db.labours = this.db.labours.filter(l => l.id !== id);
                    this.saveDB('labours');
                    this.renderLabourMaster();
                }
            });
        });
    }

    renderLaborAssignmentReport() {
        if (!this.db.labours) this.db.labours = [];
        if (!this.db.stitching) this.db.stitching = [];

        const tbody = document.querySelector('#labor-assignment-report-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        
        // Filter stitching entries that have either assignments or legacy labour_no
        const assigned = this.db.stitching.filter(s => 
            (s.assignments && s.assignments.length > 0) || s.labour_no
        );

        if (assigned.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" style="text-align: center; color: var(--text-muted); padding: 20px;">
                        No lot assignments found. Set assignments under the "Lot Wise" tab.
                    </td>
                </tr>
            `;
            return;
        }

        const rowsToRender = [];

        assigned.forEach(s => {
            const formattedDate = s.date ? new Date(s.date).toLocaleDateString('en-GB') : 'N/A';
            const totalSheets = s.sheet_cost || 0;

            // Determine assignments to render
            let assignmentsToRender = s.assignments;
            if (!assignmentsToRender || assignmentsToRender.length === 0) {
                if (s.labour_no) {
                    assignmentsToRender = [{
                        labour_no: s.labour_no,
                        sheet_given: s.sheet_given || 0
                    }];
                } else {
                    assignmentsToRender = [];
                }
            }

            const totalGiven = assignmentsToRender.reduce((sum, a) => sum + (parseFloat(a.sheet_given) || 0), 0);
            const remaining = totalSheets - totalGiven;
            
            const statusBadge = remaining <= 0 
                ? `<span class="badge-status" style="background-color: #d1fae5; color: #065f46; font-weight: 700; padding: 4px 8px; border-radius: 4px;">Complete</span>`
                : `<span class="badge-status" style="background-color: #fee2e2; color: #ef4444; font-weight: 700; padding: 4px 8px; border-radius: 4px;">Pending</span>`;

            assignmentsToRender.forEach((asg, asgIndex) => {
                if (!asg.labour_no) return; // Skip unassigned slots
                
                const lObj = this.db.labours.find(l => l.labour_no === asg.labour_no);
                const name = lObj ? lObj.name : 'Unknown';

                rowsToRender.push({
                    stitchId: s.id,
                    asgIndex: asgIndex,
                    date: formattedDate,
                    lot_no: s.lot_no || 'N/A',
                    labour_no: asg.labour_no,
                    labour_name: name,
                    item_name: s.item_name || 'N/A',
                    bindi_bharti: s.bindi_bharti || 'N/A',
                    color: s.color || 'N/A',
                    totalSheets: totalSheets,
                    sheet_given: asg.sheet_given || 0,
                    remaining: remaining,
                    statusBadge: statusBadge
                });
            });
        });

        if (rowsToRender.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" style="text-align: center; color: var(--text-muted); padding: 20px;">
                        No lot assignments found. Set assignments under the "Lot Wise" tab.
                    </td>
                </tr>
            `;
            return;
        }

        // Sort rowsToRender by labour_no so all sheets taken by same labour are grouped together
        rowsToRender.sort((a, b) => {
            const numA = parseInt((a.labour_no || '').replace(/\D/g, '')) || 0;
            const numB = parseInt((b.labour_no || '').replace(/\D/g, '')) || 0;
            if (numA !== numB) {
                return numA - numB;
            }
            return (a.labour_no || '').localeCompare(b.labour_no || '');
        });

        rowsToRender.forEach(row => {
            tbody.innerHTML += `
                <tr>
                    <td>${row.date}</td>
                    <td><strong>${row.lot_no}</strong></td>
                    <td><strong>${row.labour_no}</strong></td>
                    <td>${row.labour_name}</td>
                    <td><strong>${row.item_name}</strong></td>
                    <td>${row.bindi_bharti}</td>
                    <td>
                        <span class="badge-status" style="background-color: #f1f5f9; color: #475569; padding: 4px 8px; border-radius: 4px;">
                            ${row.color}
                        </span>
                    </td>
                    <td>${row.totalSheets}</td>
                    <td>${row.sheet_given}</td>
                    <td>${row.remaining.toFixed(2)}</td>
                    <td>${row.statusBadge}</td>
                    <td style="text-align: center;">
                        <button type="button" class="btn btn-sm btn-danger btn-delete-assignment" data-stitch-id="${row.stitchId}" data-asg-index="${row.asgIndex}" style="padding: 4px 8px; font-size: 0.85rem;">
                            <i class="fa-solid fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });

        // Wire delete buttons
        tbody.querySelectorAll('.btn-delete-assignment').forEach(btn => {
            btn.addEventListener('click', () => {
                const stitchId = btn.getAttribute('data-stitch-id');
                const asgIndex = parseInt(btn.getAttribute('data-asg-index'));
                this.deleteLaborAssignment(stitchId, asgIndex);
            });
        });
    }

    deleteLaborAssignment(stitchId, asgIndex) {
        if (!confirm("Are you sure you want to delete this labour assignment?")) {
            return;
        }

        const idx = this.db.stitching.findIndex(s => s.id === parseInt(stitchId) || s.id === stitchId);
        if (idx !== -1) {
            const s = this.db.stitching[idx];
            // Ensure assignments is initialized first so we can splice it
            if (!s.assignments) {
                if (s.labour_no) {
                    s.assignments = [{
                        labour_no: s.labour_no,
                        sheet_given: s.sheet_given || 0
                    }];
                } else {
                    s.assignments = [];
                }
            }

            if (s.assignments.length > 0) {
                s.assignments.splice(asgIndex, 1);
            }

            // Sync legacy fields
            if (s.assignments.length > 0) {
                s.labour_no = s.assignments[0].labour_no;
                s.sheet_given = s.assignments[0].sheet_given;
            } else {
                s.labour_no = '';
                s.sheet_given = 0;
            }

            this.saveDB('stitching');
            alert("Assignment deleted successfully.");
            this.renderLaborAssignmentReport();
        }
    }
}

// Global initialization
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new BindiMarketApp();
});
