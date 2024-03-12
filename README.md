# Funções Lambda

## Índice

- [O que é uma função Lambda?](#o-que-é-uma-função-lambda)
- [Como Funciona a função Lambda?](#como-funciona-a-função-lambda)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Como Rodar Localmente](#como-rodar-localmente)
  
- [O que essa função serverless-daily-cdi faz?](#o-que-essa-função-serverless-daily-cdi-faz)

# Função Lambda AWS para Envio de Mensagens para SQS

Este repositório apresenta uma Função Lambda da AWS que envia mensagens para uma fila SQS (Simple Queue Service) que será posteriormente recebida pelo backend da aplicação. Este README fornece uma visão geral sobre o que é uma Função Lambda e como ela pode ser utilizada para enviar mensagens para uma fila SQS na AWS. E também mostra como funciona o recebimento dessa mensagem pelo backend.


## O que é uma função Lambda?

Uma Função Lambda utilizando SQS é um serviço de computação serverless fornecido pela AWS. Ela permite a execução de código em resposta a eventos (nesse caso, um schedule definido, como todo dia às 4h da manhã).

## Como Funciona a função Lambda?

1. **Trigger:** A Função Lambda pode ser acionada por gatilhos definidos pelo programador, nesse caso, o gatilho é um agendamento em que todo dia às 04:00 será executada a função.

2. **Execução de Código:** Quando o evento de gatilho ocorre, a Função Lambda é automaticamente iniciada, e envia uma mensagem ao SQS (Simple Queue Service) da AWS. Nesse repositório, a mensagem enviada é 'daily-cdi-update'.

3. **Integração com o backend:** Após o envio da mensagem para o SQS, o backend deverá ter um SqsListener que "ouvirá" essa mensagem enviada pela Lambda e recebida pelo SQS.

<img src="https://i.imgur.com/hjjfbbD.png"/>

## Estrutura do Projeto

O projeto consiste em dois arquivos principais:

- **`/job/serverless.yml`:** Esse arquivo contém a configuração do serviço Serverless. Neste arquivo, se atente em:
  - Alterar o environment.ENV para o ambiente de execução (LOCAL, PRD ou DEV).
  - Em Resource, você deve inserir a ARN de sua fila, ela pode ser encontrada no painel SQS ao selecionar a fila que será utilizada.
  - Em functions.handler.name você deve definir o nome da sua função.
  - Em functions.handler.schedule, você utiliza o cron para definir uma execução agendada da lambda (caso seja de seu interesse)
  

- **`/job/handler.js`:** Esse arquivo contém a lógica da função Lambda. A função `run` é a função principal que chama a função `updateCDIDaily`, que envia mensagens para a fila SQS.
  - Altere o nome da função `updateCDIDaily` para a sua função, em `params`, altere a MessageBody para a mensagem que será enviada para o SQS, e substitua a QueueUrl pela URL de sua fila.

### Como rodar localmente

1. Primeiramente, na raiz do projeto, rode o comando
   ```bash
    npm install
    ```

2. Para realizar o teste local de sua queue, entre na pasta `job` e rode o comando abaixo (lembre-se de trocar "handler" pelo nome de sua função definida no serverless.yml):

    ```bash
    cd job
    serverless invoke local --function handler
    ```

## O que essa função serverless-daily-cdi faz?

### Objetivo da função: 
  - Salvar em nossa base de dados (tabela `daily_cdi`) os valores diários do CDI, que são obtidos diretamente por uma API pública do governo: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=DD/MM/AAAA&dataFinal=DD/MM/AAAA`. Essa API pode receber os parâmetros `dataInicial` e `dataFinal` para definir o intervalo dos dados. A atualização é feita todo dia às 4 da manhã.

### Formato de Resposta da API Utilizada:
```
[
    {
        "data": "30/12/2022",
        "valor": "0.050788"
    },
    {
        "data": "02/01/2023",
        "valor": "0.050788"
    },
    ...
]
```

### Arquivos necessários no backend para agir com essa função lambda:
- Configurar os arquivos `application.yml`, `application-dev.yml` e `application-prod.yml` com as seguintes linhas:
  - em 'sqs: queues:' você deve adicionar uma linha ao final da lista de queues com o nome da sua queue e sua URL, lembre de adicionar ao final o seu environment (LOCAL, DEV ou PROD):
    ```
    sqs:
      queues:
          saveDailyCDIQueue: "https://sqs.us-east-1.amazonaws.com/669204338030/saveDailyCDIQueue_LOCAL"

    ```
  - no mesmo arquivo, adicione o nome da sua função (dailyCDIUpdate) e suas propriedades (nesse caso, a URL da API):
    ```
    // Exemplo de outro elemento
    firebase:
      configFilePath: firebase-dev-config.json
    
    // Exemplo de outro elemento
    eodHistoricalData:
      url: "https://eodhistoricaldata.com"
      token: "seuToken"

    // Função deste repositório
    dailyCDIUpdate:
      url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json"
    ```
    
- model/DailyCDI.java
  - Esse é o arquivo model da tabela daily_cdi, ele define em código o modelo dos dados que serão inseridos na tabela SQL.
    <details> 
      <summary> Código do arquivo: </summary>
      
      ```
        // Essa tabela armazena os valores diários do CDI, contendo as colunas "date" e "value"
        @Table(name = "daily_cdi") // definindo que estou utilizando a tabela 'daily_cdi'
        public class DailyCDI extends BaseModel {
            @Id
            private LocalDate date;  
            @Column(columnDefinition = "DECIMAL(12,6)")
            private BigDecimal value;
        }
      ```
      
    </details>
- repository/DailyCDIRepository.java
  - Esse é o arquivo que interage com a tabela 'daily_cdi', ele é responsável por realizar queries SQL, como busca e inserção de dados.
    <details> 
      <summary> Código do arquivo: </summary>
        
      ```
       // A função 'existsByDate' recebe uma data e busca na base de dados se já existe algum dado com essa data, retornando true ou false
       @Repository
         public interface DailyCDIRepository extends JpaRepository<DailyCDI, Long> {
            @Query("SELECT CASE WHEN COUNT(d) > 0 THEN true ELSE false END FROM DailyCDI d WHERE d.date = :date")
            boolean existsByDate(@Param("date") LocalDate date);
         }
      ```
      
    </details>
- dto/response/DailyCDIResponse.java
  - Esse arquivo define o formato de resposta da API do governo, basicamente você define o que será retornado ao realizar um GET
    <details> 
      <summary> Código do arquivo: </summary>
      
      ```
        // A API do governo retorna um array de objetos em que cada objeto contém "data" e "valor"
        // Basta replicarmos em código o formato de resposta da API
        // em @JsonProperty(value = "X") -> X é o nome do campo que a API envia como resposta
        public class DailyCDIResponse {

          @JsonProperty(value = "data")
          @JsonFormat(pattern = "dd/MM/yyyy")
          public LocalDate date;
      
          @JsonProperty(value = "valor")
          public BigDecimal value;
      
        }
      ```
      
    </details>
- client/external/DailyCDIClient.java
    - Esse arquivo é o responsável por fazer o GET na API, recebendo os parâmetros necessários e adicionando na URL da requisição.
    <details> 
      <summary>Código do arquivo:</summary>
      
      ```
        import com.carteiradeinvestimentos.dto.response.DailyCDIResponse;

        // em FeignClient, value é o nome da mensagem do SQS, e url é a URL da API, definida no arquivo application.yml
        @FeignClient(value = "daily-cdi-update", url = "${dailyCDIUpdate.url}")
        public interface DailyCDIClient{

            // O método GetMapping realiza um GET na URL definida acima.
            // List<DailyCDIResponse> é o tipo que será retornado pela API -> uma lista de DailyCDIResponse
            // que foi definida no arquivo acima (DailyCDIResponse.java)
            // getCDIData é o nome da função. Essa função será chamada por outro componente quando for necessário utilizar a API.

            @GetMapping
            List<DailyCDIResponse> getCDIData(
                    @RequestParam("dataInicial") LocalDate startDate,
                    @RequestParam("dataFinal") LocalDate endDate
            );
        }
      ```
      
    </details>
- service/CDIService.java
  - Esse arquivo contém a função que ouvirá a mensagem do SQS. Para isso, você utilizará o 'SqsListener', passando como parâmetro value a mensagem que você enviou pela função Lambda
    <details> 
      <summary>Código do arquivo:</summary>
      
      ```
        // Primeiramente, você deve importar o Client e o Repository criados anteriormente.
        private final DailyCDIRepository dailyRepository;
        private final DailyCDIClient client;
      
        // sqs.queues.saveDailyCDIQueue tem como valor a URL da mensagem que você definiu no arquivo application.yml.
        // Essa linha define que ao ouvir a mensagem definida, a função insertNewCdiValues será executada.

        @SqsListener(value = "${sqs.queues.saveDailyCDIQueue}", deletionPolicy = SqsMessageDeletionPolicy.ALWAYS)
        public void insertNewCdiValues(String updateSignal) {

            // Dentro da função insertNewCdiValues, nós inicializamos variáveis com o primeiro dia do mês e o dia atual
            // Chamamos a função client.getCDIData passando as datas como parâmetros
            // Na prática, estamos fazendo um GET na API do governo adicionando a dataInicial e a dataFinal como parâmetros e armazenando a resposta em 'cdiInfos'
            LocalDate startDate = LocalDate.now().withDayOfMonth(1);
            LocalDate endDate = LocalDate.now();
    
            List<DailyCDIResponse> cdiInfos = client.getCDIData(startDate, endDate);
    
            for (DailyCDIResponse cdiInfo : cdiInfos) {
                // Para cada valor do cdiInfos, checamos se existe na tabela a data deste valor:
                    se não existir, nós inserimos na tabela a data e o valor
                    se já existir, nós não fazemos nada
                if (!dailyRepository.existsByDate(cdiInfo.getDate())) {
                    DailyCDI dailyCDI = new DailyCDI();
                    dailyCDI.setDate(cdiInfo.getDate());
                    dailyCDI.setValue(cdiInfo.getValue());
                    dailyRepository.save(dailyCDI);
                } else {
                     System.out.println("CDI Value already exists for date: " + cdiInfo.getDate());
                }
            }
        }

      // Ao final dessa função, a tabela 'daily_cdi' será preenchida com o valor diário do CDI, ou, caso já exista o valor na tabela, nada é feito
      ```
      
    </details>

