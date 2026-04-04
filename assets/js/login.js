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
    
    const errorIcon = `<i class="fa-solid fa-circle-exclamation"></i>`


    // user
    const name = document.querySelector('#name');
    const inputBox = name.closest('.input-box');
    const nameValue = name.value;
    const nameError = inputBox.querySelector('.error')
    nameError.innerHTML = '';

    // senha
    const password = document.querySelector('#password');
    const passwordBox = password.closest('.input-box')
    const passwordValue = password.value;
    const passwordError = passwordBox.querySelector('.error');
    passwordError.innerHTML = ''
    


    if(isEmpty(nameValue)){
        nameError.innerHTML = `${errorIcon} O campo é obrigatório`
    }

    if(isEmpty(passwordValue)){
        passwordError.innerHTML = `${errorIcon} O campo é obrigatório`

    }
})

function isEmpty(value) {
    return value === ''
}