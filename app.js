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
            outwards: []
        };
        this.currentTab = 'dashboard';
        this.tradeChart = null;

        // Initialize App
        this.init();
    }

    init() {
        this.loadDB();
        this.setupEventListeners();
        this.setupAccordionNav();
        this.updateGlobalCounters();
        this.renderAll();
        
        // Set date
        document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    loadDB() {
        // Initialize localStorage lists if not existing
        const listKeys = [
            'parties', 'cities', 'banks', 'catalogues', 'groups', 
            'colors', 'sizes', 'products', 'combo_products', 'inwards', 'outwards'
        ];

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

    saveDB(key) {
        try {
            localStorage.setItem(`bindi_${key}`, JSON.stringify(this.db[key]));
        } catch (e) {
            console.warn(`localStorage save failed for key "bindi_${key}":`, e);
        }
        this.updateGlobalCounters();
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

        // Main Tab items (like Dashboard)
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
    }

    setupEventListeners() {
        // Login Flow
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            
            if (email === 'admin@bindimarket.com' && pass === 'admin123') {
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('app-screen').style.display = 'flex';
                this.renderCharts();
            } else {
                document.getElementById('login-error').innerText = "Invalid credentials. Try admin@bindimarket.com / admin123";
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
        document.getElementById('combo-form').addEventListener('submit', (e) => this.handleComboSubmit(e));

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

        // Combo component add button
        const btnAddCombo = document.getElementById('btn-add-combo-item');
        if (btnAddCombo) {
            btnAddCombo.addEventListener('click', () => this.addComboComponentRow());
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
            'combo-list': ['Combo Packs List', 'Create and view manual multi-item combo packs.'],
            'product-reports': ['Product Reports & Valuation', 'Stock quantity lists and commercial valuations.'],
            'add-inward': ['Add Inward Product', 'Import goods into catalog warehouse.'],
            'inward-report': ['Inward Reports', 'Browse purchase and imports database history.'],
            'add-outward': ['Add Outward Product', 'Export goods to wholesale buyers.'],
            'outward-report': ['Outward Reports', 'Browse sales invoices and outward ledger.']
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
                this.resetComboForm();
                this.renderComboList();
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
                        entry_by: "Heet Punamiya"
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
        this.switchTab('product-reports');
    }

    populateAllSelects() {
        this.populatePartDropdowns();
        this.populateProductDropdowns();
        this.renderGeneratorOptions();
        this.populateReportFilterOptions();
    }

    // ==========================================
    // COMBO PRODUCTS
    // ==========================================
    resetComboForm() {
        document.getElementById('combo-form').reset();
        const container = document.getElementById('combo-items-container');
        container.innerHTML = '';
        this.addComboComponentRow();
    }

    addComboComponentRow() {
        const container = document.getElementById('combo-items-container');
        const rowId = Date.now() + Math.random().toString(36).substr(2, 4);

        let options = '<option value="">-- Choose Product --</option>';
        this.db.products.forEach(p => {
            options += `<option value="${p.id}">${p.name} (${p.color}/${p.size})</option>`;
        });

        const rowHTML = `
            <div class="grid-row-item combo-item-row" id="combo-row-${rowId}" style="grid-template-columns: 3fr 1fr 45px; margin-bottom: 8px;">
                <select class="form-control combo-prod-select" required>${options}</select>
                <input type="number" class="form-control combo-prod-qty" placeholder="Qty" min="1" value="1" required>
                <button type="button" class="btn-remove-row" onclick="app.removeComboRow('${rowId}')"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHTML);
    }

    removeComboRow(rowId) {
        const row = document.getElementById(`combo-row-${rowId}`);
        if (row) row.remove();
    }

    handleComboSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('combo-name').value.trim();
        const price = parseFloat(document.getElementById('combo-price').value) || 0;

        const items = [];
        const rows = document.querySelectorAll('.combo-item-row');
        rows.forEach(row => {
            const pId = parseInt(row.querySelector('.combo-prod-select').value);
            const qty = parseInt(row.querySelector('.combo-prod-qty').value);
            if (pId && qty) {
                items.push({ product_id: pId, qty });
            }
        });

        if (items.length === 0) {
            alert("Please add at least one component product.");
            return;
        }

        const id = Date.now();
        this.db.combo_products.push({ id, name, price, items });
        this.saveDB('combo_products');
        alert("Combo Product Created!");
        this.resetComboForm();
        this.renderComboList();
    }

    renderComboList() {
        const tbody = document.querySelector('#combo-table tbody');
        tbody.innerHTML = '';
        this.db.combo_products.forEach((c, idx) => {
            let componentText = '';
            c.items.forEach(item => {
                const prod = this.db.products.find(p => p.id === item.product_id);
                if (prod) {
                    componentText += `${prod.name} (x${item.qty}), `;
                }
            });
            componentText = componentText.replace(/,\s*$/, "");

            tbody.innerHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${c.name}</strong></td>
                    <td>₹${c.price.toFixed(2)}</td>
                    <td><small>${componentText}</small></td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="app.deleteCombo(${c.id})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    deleteCombo(id) {
        if (!confirm("Are you sure?")) return;
        this.db.combo_products = this.db.combo_products.filter(c => c.id !== id);
        this.saveDB('combo_products');
        this.renderComboList();
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
                <input type="number" class="form-control inward-pkt" placeholder="Box" min="0" oninput="app.calculateInwardRow('${rowId}')" required>
                <input type="number" class="form-control inward-per-pkt" placeholder="Pieces" min="0" oninput="app.calculateInwardRow('${rowId}')" required>
                <input type="number" class="form-control inward-total-qty" placeholder="Pieces" readonly>
                <input type="number" class="form-control inward-price" placeholder="Price" step="0.01" min="0" oninput="app.calculateInwardRow('${rowId}')" required>
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
            row.querySelector('.inward-price').value = prod.cost_price;
            this.calculateInwardRow(rowId);
        }
    }

    calculateInwardRow(rowId) {
        const row = document.getElementById(`row-${rowId}`);
        if (!row) return;

        const pkt = parseFloat(row.querySelector('.inward-pkt').value) || 0;
        const perPkt = parseFloat(row.querySelector('.inward-per-pkt').value) || 0;
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
        this.db.inwards.forEach(tx => {
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
                <input type="number" class="form-control outward-pkt" placeholder="Box" min="0" oninput="app.calculateOutwardRow('${rowId}')" required>
                <input type="number" class="form-control outward-pieces" placeholder="Pieces" min="0" oninput="app.calculateOutwardRow('${rowId}')" required>
                <input type="number" class="form-control outward-price" placeholder="Price" step="0.01" min="0" oninput="app.calculateOutwardRow('${rowId}')" required>
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
            row.querySelector('.outward-price').value = prod.sell_price;
            this.calculateOutwardRow(rowId);
        }
    }

    calculateOutwardRow(rowId) {
        const row = document.getElementById(`row-${rowId}`);
        if (!row) return;

        const pieces = parseFloat(row.querySelector('.outward-pieces').value) || 0;
        const price = parseFloat(row.querySelector('.outward-price').value) || 0;

        const total = pieces * price;
        row.querySelector('.outward-total').value = total.toFixed(2);

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
        this.db.outwards.forEach(tx => {
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
                            callback: function(value) { return '₹' + value; }
                        }
                    }
                }
            }
        });
    }
}

// Global initialization
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new BindiMarketApp();
});
