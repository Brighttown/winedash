const go = async () => {
    try {
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@winedash.local', password: 'admin123' })
        });
        const { token } = await loginRes.json();

        const res = await fetch('http://localhost:3000/api/wines', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: "Test Wine",
                region: "Test Region",
                country: "Test Country",
                vintage: 2023,
                grape: "Merlot",
                type: "dessert",
                supplier: 'Geïmporteerd uit Database',
                purchase_price: 0,
                sell_price: 0,
                stock_count: 0,
                min_stock_alert: 5
            })
        });
        const data = await res.json();
        console.log(data);
    } catch (err) {
        console.log(err);
    }
}
go();
