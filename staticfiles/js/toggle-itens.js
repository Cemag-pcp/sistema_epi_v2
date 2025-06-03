 document.addEventListener('DOMContentLoaded', function() {
        // Adiciona evento de clique para mostrar/esconder funcionários
        document.querySelectorAll('.toggle-funcionarios').forEach(button => {
          button.addEventListener('click', function() {
            const padraoId = this.getAttribute('data-id');
            const funcionariosList = document.getElementById(`funcionarios-${padraoId}`);
            const isShown = this.getAttribute('data-shown') === 'true';
            
            if (isShown) {
              funcionariosList.style.display = 'none';
              this.setAttribute('data-shown', 'false');
              this.querySelector('i').className = 'bi bi-chevron-down';
            } else {
              funcionariosList.style.display = 'block';
              this.setAttribute('data-shown', 'true');
              this.querySelector('i').className = 'bi bi-chevron-up';
            }
          });
        });

        // Adiciona evento de clique para mostrar/esconder itens
        document.querySelectorAll('.toggle-itens').forEach(button => {
          button.addEventListener('click', function() {
            const padraoId = this.getAttribute('data-id');
            const itensList = document.getElementById(`itens-${padraoId}`);
            const isShown = this.getAttribute('data-shown') === 'true';
            
            if (isShown) {
              itensList.style.display = 'none';
              this.setAttribute('data-shown', 'false');
              this.querySelector('i').className = 'bi bi-chevron-down';
            } else {
              itensList.style.display = 'block';
              this.setAttribute('data-shown', 'true');
              this.querySelector('i').className = 'bi bi-chevron-up';
            }
          });
        });
    });