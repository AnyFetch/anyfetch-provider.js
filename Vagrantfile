# -*- mode: ruby -*-
# vi: set ft=ruby :

# TODO: use our recipe for tika
$script = <<SCRIPT
SCRIPT

Vagrant.configure("2") do |config|
  config.vm.hostname = "anyFetchproviderlib"

  config.vm.box = "precise64"
  config.vm.box_url = "http://files.vagrantup.com/precise64.box"
  
  config.vm.network :forwarded_port, host: 8000, guest: 8000
  
  config.berkshelf.berksfile_path = "./Berksfile"
  config.berkshelf.enabled = true
  config.omnibus.chef_version = '11.6.0'

  config.vm.provision :chef_solo do |chef|
    chef.run_list = [
      "recipe[apt]",
      "recipe[java]",
      "recipe[nodejs]",
      "recipe[mongodb::10gen_repo]",
      "recipe[mongodb::default]",
    ]

    chef.json = {
      :java => {
        :install_flavor => "openjdk",
        :jdk_version => "7"
      }
      :mongodb => {
        :package_version => "2.4.5"
      }
    }
  end

  config.vm.provision :shell,
      :inline => $script
end
