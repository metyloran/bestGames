const products = [
{id: 1, title: "Cyberpunk 2077", price: 29, tags: ["RPG", "Action"], image: "https://avatars.mds.yandex.net/i?id=b7ba310c97d2285ffd9f9ff9f56e9328_l-3809909-images-thumbs&n=13" },
{id: 2, title: "Minecraft", price: 15, tags: ["Sandbox"], image: "https://avatars.mds.yandex.net/i?id=b29271b01cad1ed79d1cdbafcef8db8ed48ec47e-10289673-images-thumbs&n=13" },
{id: 3, title: "The Witcher 3", price: 22, tags: ["RPG"], image: "https://m.exophase.com/xbox/games/o/4b551.png?77bfc2efd27780881660e1ce6cc0d76d" },
{id: 4, title: "Hollow Knight: Silksong", price: 22, tags: ["Metroid"], image: "https://avatars.mds.yandex.net/i?id=e7e5bf4401d90ff4c8ee9dd2386953f87e734b52-5210535-images-thumbs&n=13" }
];


const grid = document.getElementById("grid");
const search = document.getElementById("search");


function render(list) {
grid.innerHTML = list
.map(
(p) => `
<div class="card">
<img src="${p.image}" />
<h3>${p.title}</h3>
<p>${p.tags.join(" • ")}</p>
<strong>$${p.price}</strong>
<button class="btn add-to-cart" data-id="${p.id}">В корзину</button>
</div>`
)
.join("");

let cart = JSON.parse(localStorage.getItem("cart")) || [];

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
    }
document.querySelectorAll(".add-to-cart").forEach(btn => {
  btn.onclick = () => {
    const id = Number(btn.dataset.id);
    const product = products.find(p => p.id === id);

    cart.push(product);
    saveCart();
    updateCartUI();
  };
});
function updateCartUI() {
  const list = document.getElementById("cartList");
  const total = document.getElementById("cartTotal");

  list.innerHTML = cart
    .map((item, i) => `
      <div class="cart-item">
        <span>${item.title} — $${item.price}</span>
        <button class="btn small remove" data-index="${i}">Удалить</button>
      </div>
    `)
    .join("");

  total.innerText = cart.reduce((sum, item) => sum + item.price, 0);

  document.querySelectorAll(".remove").forEach(btn => {
    btn.onclick = () => {
      const index = btn.dataset.index;
      cart.splice(index, 1);
      saveCart();
      updateCartUI();
    };
  });
}
document.getElementById("openCart").onclick = () =>
  cartModal.classList.remove("hidden");

document.getElementById("closeCart").onclick = () =>
  cartModal.classList.add("hidden");

document.querySelectorAll(".item-btn").forEach((btn) => {
btn.onclick = () => btn.classList.toggle("active");
});
}
search.oninput = () => {
const text = search.value.toLowerCase();
render(products.filter((p) => p.title.toLowerCase().includes(text)));
};


render(products);


// ------------------ РЕГИСТРАЦИЯ / ВХОД ------------------
const loginModal = document.getElementById("loginModal");
const registerModal = document.getElementById("registerModal");


const openLogin = document.getElementById("openLogin");
const openRegister = document.getElementById("openRegister");
const closeLogin = document.getElementById("closeLogin");
const closeRegister = document.getElementById("closeRegister");


openLogin.onclick = () => loginModal.classList.remove("hidden");
openRegister.onclick = () => registerModal.classList.remove("hidden");
closeLogin.onclick = () => loginModal.classList.add("hidden");
closeRegister.onclick = () => registerModal.classList.add("hidden");


// ----- Локальное "хранилище пользователей" -----
let user = JSON.parse(localStorage.getItem("user")) || null;


function updateAccount() {
const acc = document.getElementById("account");
if (user) {
acc.classList.remove("hidden");
document.getElementById("accName").innerText = user.name;
document.getElementById("accEmail").innerText = user.email;
} else {
acc.classList.add("hidden");
}
}
updateAccount();
// ------------------ РЕГИСТРАЦИЯ ------------------
document.getElementById("registerBtn").onclick = () => {
const name = document.getElementById("regName").value;
const email = document.getElementById("regEmail").value;
const pass = document.getElementById("regPass").value;


if (!name || !email || !pass) return alert("Заполните все поля");


user = { name, email, pass };
localStorage.setItem("user", JSON.stringify(user));


alert("Регистрация успешна!");
registerModal.classList.add("hidden");
updateAccount();
};
// ------------------ ЛОГИН ------------------
document.getElementById("loginBtn").onclick = () => {
const email = document.getElementById("loginEmail").value;
const pass = document.getElementById("loginPass").value;


if (!user) return alert("Пользователь не зарегистрирован");
if (email !== user.email || pass !== user.pass) return alert("Неверные данные");


alert("Добро пожаловать!");
loginModal.classList.add("hidden");
updateAccount();
};


// ------------------ ВЫХОД ------------------
document.getElementById("logout").onclick = () => {
user = null;
localStorage.removeItem("user");
updateAccount();
alert("Вы вышли из аккаунта");
};