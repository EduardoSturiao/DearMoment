

//transiçao pro login

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', e => {
            const href = link.getAttribute('href');

            // Links âncora: scroll suave, sem transição
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) target.scrollIntoView({ behavior: 'smooth' });
                return;
            }

            // Links externos/outras páginas: transição de fade
            e.preventDefault();
            document.body.classList.add('fade-out');
            setTimeout(() => {
                window.location = link.href;
            }, 500);
        });
    });
});




//validaçao dos campos no registro

const form = document.querySelector('#form');

if (form) { // não executa em páginas sem formulário

form.addEventListener('submit', function (e) {
    e.preventDefault();

    const fields = [
        {
            id: 'name',
            label: 'Nome',
            validator: nameIsValid
        },
        {
            id: 'last_name',
            label: 'Sobrenome',
            validator: nameIsValid
        },
        {
            id: 'birthdate',
            label: 'Nascimento',
            validator: dateIsValid
        },
        {
            id: 'email',
            label: 'E-mail',
            validator: emailIsValid
        },
        {
            id: 'password',
            label: 'Senha',
            validator: passwordIsSecure
        },
        {
            id: 'confirm_password',
            label: 'Confirmar senha',
            validator: passwordMatch
        }
    ]
    
    const errorIcon = '<i class="fa-solid fa-circle-exclamation"></i>';

    fields.forEach(function (field) {
        const input = document.getElementById(field.id);
        const inputBox = input.closest('.input-box');
        const inputValue = input.value;

        const errorSpan = inputBox.querySelector('.error');
        errorSpan.innerHTML = ''; //Campo ja inicia vazio

        inputBox.classList.remove('invalid')
        inputBox.classList.add('valid')

        const fieldValidator = field.validator(inputValue);

        if (!fieldValidator.isValid) {
            errorSpan.innerHTML = `${errorIcon} ${fieldValidator.errorMessage}`;
            inputBox.classList.add('invalid');
            inputBox.classList.remove('valid');
            return;
        } 
    })

    const genders = document.getElementsByName('gender');
    const radioContainer = document.querySelector('.radio-container');
    const genderErrorSpan = radioContainer.querySelector('.error');

    const selectedGender =  [...genders].find(input => input.checked);
    radioContainer.classList.add('invalid');
    radioContainer.classList.remove('valid');
    genderErrorSpan.innerHTML = `${errorIcon} Selecione um gênero!`;

    if (selectedGender) {
        radioContainer.classList.add('valid');
        radioContainer.classList.remove('invalid');
        genderErrorSpan.innerHTML = '';
        return;
    }
})

} // fim do if (form)

function isEmpty(value) {
    return value === '';
}

function nameIsValid(value) {
    const validator = {
        isValid: true,
        errorMessage: null
    };

    if (isEmpty(value)) {
        validator.isValid = false;
        validator.errorMessage = 'O campo é obrigatório!';
        return validator;
    }

    const min = 3;
    if (value.length < min){
        validator.isValid = false;
        validator.errorMessage = `O nome deve ter no mínimo ${min} caracteres!`
        return validator;
    }

    const regex = /^[a-zA-Z]/;
    if (!regex.test(value)) {
        validator.isValid = false;
        validator.errorMessage = 'O campo deve conter apenas letras!'
    }

    return validator;
}

function dateIsValid(value) {
    const validator = {
        isValid: true,
        errorMessage: null
    }

    if (isEmpty(value)) {
        validator.isValid = false;
        validator.errorMessage = 'O nascimento é obrigatório!';
        return validator;
    }

    const year = new Date(value).getFullYear();

    if (year < 1920 || year > new Date().getFullYear()) {
        validator.isValid = false;
        validator.errorMessage = 'Data inválida!';
        return validator;
    }

    return validator;
}

function emailIsValid(value) {
    const validator = {
        isValid: true,
        errorMessage: null
    }

    if (isEmpty(value)) {
        validator.isValid = false;
        validator.errorMessage = 'O e-mail é obrigatório!';
        return validator;
    }

    const regex = new RegExp("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$");
    if (!regex.test(value)) {
        validator.isValid = false;
        validator.errorMessage = 'O e-mail precisa ser válido!';
        return validator;
    }

    return validator;
}

function passwordIsSecure(value) {
    const validator = {
        isValid: true,
        errorMessage: null
    }

    if (isEmpty(value)) {
        validator.isValid = false;
        validator.errorMessage = 'O senha é obrigatória!';
        return validator;
    }

    const regex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})");

    if (!regex.test(value)) {
        validator.isValid = false;
        validator.errorMessage = `
            Sua senha deve conter ao menos: <br/>
            8 dígitos <br/>
            1 letra minúscula <br/>
            1 letra maiúscula  <br/>
            1 número </br>
            1 caractere especial!
        `;
        return validator;
    }

    return validator;
}

function passwordMatch(value) {
    const validator = {
        isValid: true,
        errorMessage: null
    }

    const passwordValue = document.getElementById('password').value;
    
    if (value === '' || passwordValue !== value) {
        validator.isValid = false;
        validator.errorMessage = 'Senhas não condizem!';
        return validator;
    }

    return validator;
}



// contador de combinações possíveis

(function () {
  var el = document.getElementById('combCounter');
  if (!el) return;

  var target   = 1069440;
  var observed = false;

  function animateCounter() {
    var start    = null;
    var duration = 1300;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(ease * target).toLocaleString('pt-BR');
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var observer = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting && !observed) {
      observed = true;
      animateCounter();
    }
  }, { threshold: 0.4 });

  observer.observe(el);
})();


//efeito visual do icone da senha

const passwordIcons = document.querySelectorAll('.password-icon');

passwordIcons.forEach(icon => {
    icon.addEventListener('click', function () {
        const input = this.parentElement.querySelector('.form-control');
        input.type = input.type === 'password' ? 'text' : 'password';
        this.classList.toggle('fa-eye');
    })
})

