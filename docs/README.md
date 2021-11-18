# TheEye Supervisor Core API

## What is TheEye?

<table>
  <tr>
    <td> <img src="images/TheEye-Of-Sauron.png"></td>
    <td> TheEye is a process automation platform developed in NodeJS. Best used as BPM, Rapid Backoffice Development (RDA) and processes' hub.
Technically TheEye is a choreographer 
    </td>
  </tr> 
</table>
<div class="container-fluid" style="text-align: center; font-family: 'Open Sans', sans-serif; width: 100%; padding-right: 15px; padding-left: 15px; margin-right: auto; margin-left: auto;">
  <div class="row" style="display: flex; flex-wrap: wrap; margin-right: -15px; margin-left: -15px;">
    <div class="col-md-12" style="flex: 0 0 50%; max-width: 50%;">
      <table>
        <th><a href="https://bit.ly/3kyybPA"; target="_blank"><img src="https://news.theeye.io/wp-content/uploads/2021/11/TheEye_redes-sociales-linkedin.png" style="width: 45%; margin: 0 auto;"></a></th>
        <th><a href="https://bit.ly/3Di5FsU"; target="_blank"><img src="https://news.theeye.io/wp-content/uploads/2021/11/TheEye_redes-sociales-grupo-rpa-copy.png" style="width: 45%; margin: 0 auto;"></a></th>
        <th><a href="https://bit.ly/3kuVqtE"; target="_blank"><img src="https://news.theeye.io/wp-content/uploads/2021/11/TheEye_redes-sociales-twitter.png" style="width: 45%; margin: 0 auto;"></a></th>
        <th><a href="https://bit.ly/31PIRTb"; target="_blank"><img src="https://news.theeye.io/wp-content/uploads/2021/11/TheEye_blog-theeye-news.png" style="width: 45%; margin: 0 auto;"></a></th>
        <th><a href="https://bit.ly/31Q7WNT"; target="_blank"><img src="https://news.theeye.io/wp-content/uploads/2021/11/TheEye_redes-sociales-instagram.png" style="width: 45%; margin: 0 auto;"></a></th>
        <th><a href="https://bit.ly/2YDFs8O"; target="_blank"><img src="https://news.theeye.io/wp-content/uploads/2021/11/TheEye_redes-sociales-youtube.png" style="width: 45%; margin: 0 auto;"></a></th>
      </table>
    </div>
  </div>
</div>

## Architecture

![Image of TheEye-overview](images/TheEye-core-Architect.png)

If you want more information please read the https://documentation.theeye.io

## Environment settings

Provide this env variables to change the initial behaviour of the core Api. Once started cannot be changed.


* Rest API - Api to interactar with TheEye resources. https://documentation.theeye.io/api/auth/

* Monitoring System - It works as a background process. Will check Monitors status.

* Internal commander API (listen on port 6666 only localhost) - This API is not documented. It is used only for internal management purpose.

### Environment configuration

Basic configuration

| Variable Name | Usage |
| ----- | ----- |
| PORT | change rest api port. default 60080 |
| NODE_ENV | choose the configuration file that the api should use. |
| DEBUG | enabled/disable the debug module. check npm debug module for more information |
| THEEYE_NODE_HOSTNAME | this features extends the debug module. add the hostname to debug output and used to define a Hostname on Dockers |
| VERSION | api version. if not provided will try to detected the version using git. |
| CONFIG_NOTIFICATIONS_API_URL | target notification system url |


Components Control. Can be configured to do one o more things (or nothing)


| Variable Name | Usage |
| ----- | ----- |
| COMMANDER_DISABLED | disable internal commander api |
| MONITORING_DISABLED | disable monitoring system. system monitors will not be checked anymore. will only change when bots and agents send updates |
| API_DISABLED | disable rest api |
| SCHEDULER_JOBS_DISABLED | disable internal scheduler execution. scheduler-jobs will be created using the rest api but task will never be executed. theeye-jobs execution timeout will be never checked. |

### Start development sample

`DEBUG=*eye* NODE_ENV=localdev MONITORING_DISABLED= SCHEDULER_JOBS_DISABLED= npx nodemon --inspect $PWD/core/main.js`
