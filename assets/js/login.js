// efeito visual de icone

const passwordIcons = document.querySelectorAll('.password-icon');

passwordIcons.forEach(icon => {
    icon.addEventListener('click', function () {
        const input = this.closest('.input-field').querySelector('.form-control');
        input.type = input.type === 'password' ? 'text' : 'password';
        this.classList.toggle('fa-eye');
    })
})


// validacao de user e senha

const form = document.querySelector('#form');

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const errorIcon = `<i class="fa-solid fa-circle-exclamation"></i>`;
    let hasError = false;

    // user
    const name = document.querySelector('#name');
    const inputBox = name.closest('.input-box');
    const nameValue = name.value;
    const nameError = inputBox.querySelector('.error');
    nameError.innerHTML = '';

    // senha
    const password = document.querySelector('#password');
    const passwordBox = password.closest('.input-box');
    const passwordValue = password.value;
    const passwordError = passwordBox.querySelector('.error');
    passwordError.innerHTML = '';

    if (isEmpty(nameValue)) {
        nameError.innerHTML = `${errorIcon} O campo é obrigatório`;
        hasError = true;
    }

    if (isEmpty(passwordValue)) {
        passwordError.innerHTML = `${errorIcon} O campo é obrigatório`;
        hasError = true;
    }

    if (hasError) return;

    // Login bem-sucedido — persiste sessão simulada até integração com backend
    localStorage.setItem('soulmates_session', JSON.stringify({ loggedIn: true, email: nameValue }));

    // Redireciona: se vier do wizard, vai para pagamento; senão, vai para home
    const pendingPlan = localStorage.getItem('soulmates_pending_plan');
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.4s ease';
    setTimeout(() => {
        window.location.href = pendingPlan ? './pagamento.html' : './index.html';
    }, 400);
})

function isEmpty(value) {
    return value === '';
}
